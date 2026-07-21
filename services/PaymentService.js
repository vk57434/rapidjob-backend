const Cashfree = require('../config/cashfree');
const crypto = require('crypto');
const { rtdb, db, admin } = require('../firebase-admin');

class PaymentService {
    async createOrder(uid, planId, userRole) {
        console.log(`[CASHFREE_ORDER_START] UID: ${uid}, Plan: ${planId}`);
        
        const planDoc = await db.collection('plans').doc(planId).get();
        if (!planDoc.exists) throw new Error('Plan not found');
        const planData = planDoc.data();
        const amount = planData.price;

        const request = {
            order_amount: amount,
            order_currency: 'INR',
            order_id: `ord_${uid.substring(0, 8)}_${Date.now()}`,
            customer_details: {
                customer_id: uid,
            },
            order_meta: {
                notify_url: 'https://rapidjob-backend-u7qr.onrender.com/api/payment/webhook',
            },
            order_note: JSON.stringify({ uid, planId, role: userRole, planName: planData.name })
        };

        try {
            const response = await Cashfree.PGCreateOrder('2023-08-01', request);
            return response.data;
        } catch (error) {
            console.error('[CASHFREE_ORDER_FAIL]', error.response?.data || error.message);
            throw new Error('Cashfree Order creation failed');
        }
    }

    verifyWebhookSignature(signature, body) {
        const secret = process.env.CASHFREE_CLIENT_SECRET;
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('base64');
        return signature === expectedSignature;
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

        return subData;
    }

    async isPaymentAlreadyUsed(paymentId) {
        const doc = await db.collection('payments').doc(paymentId).get();
        return doc.exists;
    }
}

module.exports = new PaymentService();
