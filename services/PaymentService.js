const Cashfree = require('../config/cashfree');
const { rtdb, db, admin } = require('../firebase-admin');

class PaymentService {
    async createOrder(uid, planId, userRole) {
        console.log(`[CASHFREE_ORDER_START] UID: ${uid}, Plan: ${planId}`);
        
        const [planDoc, userDoc] = await Promise.all([
            db.collection('plans').doc(planId).get(),
            db.collection('users').doc(uid).get()
        ]);

        if (!planDoc.exists) throw new Error('Plan not found');
        const planData = planDoc.data();
        const userData = userDoc.exists ? userDoc.data() : { name: 'User', email: 'no-email@rapidjob.com', phone: '0000000000' };

        const amount = planData.price;
        const orderId = `ord_${uid.substring(0, 8)}_${Date.now()}`;

        await db.collection('order_metadata').doc(orderId).set({
            uid,
            planId,
            role: userRole,
            planName: planData.name,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const request = {
            order_amount: amount,
            order_currency: 'INR',
            order_id: orderId,
            customer_details: {
                customer_id: uid,
                customer_name: userData.name || 'User',
                customer_email: userData.email || 'no-email@rapidjob.com',
                customer_phone: userData.phone || '0000000000'
            },
            order_meta: {
                notify_url: 'https://rapidjob-backend-u7qr.onrender.com/api/payment/webhook',
            }
        };

        try {
            const response = await Cashfree.PGCreateOrder('2023-08-01', request);
            console.log(`[CASHFREE_ORDER_CREATED] OrderID: ${orderId}`);
            return response.data;
        } catch (error) {
            console.error('[CASHFREE_ERROR]', error.response?.data || error.message);
            throw new Error('Cashfree Order creation failed');
        }
    }

    verifyWebhookSignature(signature, rawBody) {
        // The SDK's PGVerifyWebhookSignature expects the body as a string.
        // If rawBody is a Buffer, we convert it.
        const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : String(rawBody);

        console.log('[CASHFREE_VERIFY_DEBUG]', {
            isBuffer: Buffer.isBuffer(rawBody),
            bodyType: typeof rawBody,
            bodyLength: rawBody.length
        });

        try {
            return Cashfree.PGVerifyWebhookSignature(bodyString, signature, process.env.CASHFREE_WEBHOOK_SECRET);
        } catch (error) {
            console.error('[CASHFREE_SDK_VERIFY_ERROR]', error);
            return false;
        }
    }

    async getPaymentStatus(orderId) {
        const response = await Cashfree.PGOrderFetchPayments('2023-08-01', orderId);
        return response.data;
    }

    async activateSubscription(uid, planId, paymentDetails) {
        const planDoc = await db.collection('plans').doc(planId).get();
        if (!planDoc.exists) throw new Error('Plan not found');
        const planData = planDoc.data();

        const now = Date.now();
        const expiry = now + (planData.durationDays * 24 * 60 * 60 * 1000);

        const subData = {
            userId: uid,
            planId: planId,
            planName: planData.name,
            status: 'ACTIVE',
            remainingJobs: planData.maxJobPosts || 0,
            jobsLimit: planData.maxJobPosts || 0,
            expiryDate: expiry,
            purchaseDate: now,
            paymentId: paymentDetails.cf_payment_id,
            paymentGateway: 'CASHFREE',
            active: true
        };

        await rtdb.ref(`subscriptions/${uid}`).set(subData);

        const isRecruiter = planData.maxJobPosts > 0;
        const collection = isRecruiter ? 'subscriptions' : 'jobSeekerSubscriptions';
        await db.collection(collection).doc(uid).set({
            ...subData,
            expiryAt: admin.firestore.Timestamp.fromMillis(expiry),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await db.collection('payments').doc(paymentDetails.cf_payment_id).set({
            id: paymentDetails.cf_payment_id,
            orderId: paymentDetails.order_id,
            userId: uid,
            amount: paymentDetails.order_amount,
            currency: 'INR',
            planId,
            planName: planData.name,
            gateway: 'CASHFREE',
            status: 'SUCCESS',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[CASHFREE_SUBSCRIPTION_ACTIVATED] UID: ${uid}, Payment: ${paymentDetails.cf_payment_id}`);
        return subData;
    }

    async isPaymentAlreadyUsed(paymentId) {
        const doc = await db.collection('payments').doc(paymentId).get();
        return doc.exists;
    }
}

module.exports = new PaymentService();
