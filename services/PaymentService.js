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

    /**
     * LOAD PLAN DETAILS FROM FIRESTORE (REPLACED HARDCODED LOGIC)
     * Fetches the source of truth for subscription parameters directly from Firestore.
     */
    async getPlanDetails(planId) {
        console.log(`[FIRESTORE_PLAN_LOOKUP_START] ID: ${planId}`);
        const planPath = `plans/${planId}`;

        try {
            // Fetch Plan Document
            const planDoc = await db.collection('plans').doc(planId).get();

            console.log(`[FIRESTORE_PLAN_LOOKUP_RESULT] Path: ${planPath}, Exists: ${planDoc.exists}`);

            if (!planDoc.exists) {
                console.error(`[PLAN_NOT_FOUND] Firestore document missing at: ${planPath}`);
                return null;
            }

            const data = planDoc.data();
            console.log(`[PLAN_DATA_LOADED]`, JSON.stringify(data));

            // Map Firestore data to service-compatible format
            // category helps determine if it's a RECRUITER or JOB_SEEKER plan
            const category = (data.category || '').toUpperCase();
            const maxJobPosts = parseInt(data.maxJobPosts) || 0;

            return {
                planName: data.name || 'Unknown Plan',
                durationDays: parseInt(data.durationDays) || 30,
                maxJobPosts: maxJobPosts,
                isRecruiter: maxJobPosts > 0 || category === 'RECRUITER' || category === 'DASHBOARD',
                price: data.price,
                gst: data.gst
            };
        } catch (error) {
            console.error(`[FIRESTORE_PLAN_ERROR] Error fetching ${planPath}:`, error.message);
            throw error;
        }
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

    async activateSubscription(uid, planId, planDetails, paymentDetails, role) {
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

        // Determine collection based on explicit role OR plan logic (Fallback)
        let collection = 'subscriptions'; // Default for recruiters
        if (role) {
            collection = (role === 'RECRUITER') ? 'subscriptions' : 'jobSeekerSubscriptions';
        } else {
            collection = planDetails.isRecruiter ? 'subscriptions' : 'jobSeekerSubscriptions';
        }

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
