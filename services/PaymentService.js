const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const { rtdb, db, admin } = require('../firebase-admin');

class PaymentService {
    async createOrder(amount, currency = 'INR', receipt, planId) {
        console.log('PAYMENT START');
        
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay credentials missing');
        }

        const options = {
            amount: Math.round(amount),
            currency,
            receipt,
            notes: { planId }
        };

        try {
            const order = await razorpay.orders.create(options);
            console.log('ORDER CREATED:', order.id);
            return order;
        } catch (error) {
            console.error('FAILED: Razorpay Order Creation', error);
            throw error;
        }
    }

    verifySignature(orderId, paymentId, signature) {
        console.log(`[SIGNATURE_CHECK] Order: ${orderId}, Payment: ${paymentId}`);
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        console.log(`[SIGNATURE_COMPARE] Generated: ${generatedSignature.substring(0, 10)}..., Received: ${signature.substring(0, 10)}...`);
        return generatedSignature === signature;
    }

    async getPaymentDetails(paymentId) {
        try {
            const payment = await razorpay.payments.fetch(paymentId);
            return payment;
        } catch (error) {
            console.error('FAILED: Fetching Payment Details', error);
            throw error;
        }
    }

    getPlanDetails(planId) {
        const id = planId.toLowerCase();
        console.log(`[PLAN_LOOKUP] ID: ${id}`);

        // Recruiter Plans
        if (id.includes('monthly')) {
            const jobs = id.includes('multiple') ? 5 : 1;
            return {
                planName: id.includes('multiple') ? 'Multiple Hire Monthly' : 'Single Hire Monthly',
                durationDays: 30,
                maxJobPosts: jobs,
                isRecruiter: true
            };
        }
        if (id.includes('quarterly')) return { planName: 'Recruiter Quarterly', durationDays: 90, maxJobPosts: 20, isRecruiter: true };
        if (id.includes('yearly')) return { planName: 'Recruiter Yearly', durationDays: 365, maxJobPosts: 100, isRecruiter: true };

        // Job Seeker Plans
        if (id === 'silver' || id.includes('silver')) return { planName: 'Silver Weekly', durationDays: 7, maxJobPosts: 0, isRecruiter: false };
        if (id === 'gold' || id.includes('gold')) return { planName: 'Gold Monthly', durationDays: 30, maxJobPosts: 0, isRecruiter: false };
        if (id === 'platinum' || id.includes('platinum')) return { planName: 'Platinum Quarterly', durationDays: 90, maxJobPosts: 0, isRecruiter: false };

        console.error(`[PLAN_NOT_FOUND] No mapping for: ${id}`);
        throw new Error(`Plan details not found for ID: ${planId}`);
    }

    async getActiveSubscription(uid) {
        const snapshot = await rtdb.ref(`subscriptions/${uid}`).once('value');
        if (snapshot.exists()) {
            const sub = snapshot.val();
            const now = Date.now();
            if (sub.status === 'ACTIVE' && sub.expiryDate > now) {
                return sub;
            }
        }
        return null;
    }

    async activateSubscription(uid, planId, planDetails, paymentDetails) {
        const now = Date.now();
        const expiry = now + (planDetails.durationDays * 24 * 60 * 60 * 1000);

        const subData = {
            userId: uid,
            planId: planId,
            planName: planDetails.planName,
            status: 'ACTIVE',
            remainingJobs: planDetails.maxJobPosts,
            jobsLimit: planDetails.maxJobPosts,
            expiryDate: expiry,
            purchaseDate: now,
            updatedAt: now,
            paymentId: paymentDetails.id,
            paymentGateway: 'razorpay',
            active: true
        };

        // 1. Update RTDB - Source of Truth
        await rtdb.ref(`subscriptions/${uid}`).set(subData);
        console.log('[RTDB_UPDATED] OK');

        // 2. Update Firestore Subscription Copy (Used by UI and Security Rules)
        const firestoreSubData = {
            userId: uid,
            planId: planId,
            planName: planDetails.planName,
            status: 'ACTIVE',
            remainingJobs: planDetails.maxJobPosts,
            expiryAt: admin.firestore.Timestamp.fromMillis(expiry),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const collection = planDetails.isRecruiter ? 'subscriptions' : 'jobSeekerSubscriptions';
        await db.collection(collection).doc(uid).set(firestoreSubData, { merge: true });
        console.log(`[FIRESTORE_UPDATED] Collection: ${collection}, UID: ${uid}`);

        // 3. Save Payment History
        const paymentRecord = {
            id: paymentDetails.id,
            paymentId: paymentDetails.id,
            orderId: paymentDetails.order_id,
            userId: uid,
            amount: paymentDetails.amount / 100,
            currency: paymentDetails.currency,
            planId,
            planName: planDetails.planName,
            gateway: 'razorpay',
            status: 'SUCCESS',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('payments').doc(paymentDetails.id).set(paymentRecord);
        console.log('[PAYMENT_HISTORY_SAVED] OK');

        return subData;
    }

    async isPaymentAlreadyUsed(paymentId) {
        const doc = await db.collection('payments').doc(paymentId).get();
        return doc.exists;
    }
}

module.exports = new PaymentService();
