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
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        const isValid = generatedSignature === signature;
        if (isValid) {
            console.log('SIGNATURE VERIFIED');
        } else {
            console.error('FAILED: Invalid Signature');
        }
        return isValid;
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
        console.log('PLAN LOADED:', planId);
        // Recruiter Plans
        if (planId.includes('monthly')) return { planName: 'Monthly Plan', durationDays: 30, maxJobPosts: 10, isRecruiter: true };
        if (planId.includes('quarterly')) return { planName: 'Quarterly Plan', durationDays: 90, maxJobPosts: 40, isRecruiter: true };
        if (planId.includes('yearly')) return { planName: 'Yearly Plan', durationDays: 365, maxJobPosts: 200, isRecruiter: true };

        // Job Seeker Plans
        if (planId === 'silver') return { planName: 'Silver Weekly', durationDays: 7, maxJobPosts: 0, isRecruiter: false };
        if (planId === 'gold') return { planName: 'Gold Monthly', durationDays: 30, maxJobPosts: 0, isRecruiter: false };
        if (planId === 'platinum') return { planName: 'Platinum Quarterly', durationDays: 90, maxJobPosts: 0, isRecruiter: false };

        throw new Error('PLAN_NOT_FOUND');
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
            paymentGateway: 'razorpay'
        };

        // Update RTDB - Single Source of Truth
        await rtdb.ref(`subscriptions/${uid}`).set(subData);
        console.log('SUBSCRIPTION UPDATED');

        // Save Payment History in Firestore
        const paymentRecord = {
            paymentId: paymentDetails.id,
            orderId: paymentDetails.order_id,
            userId: uid,
            amount: paymentDetails.amount / 100, // back to rupees
            currency: paymentDetails.currency,
            planId,
            planName: planDetails.planName,
            gateway: 'razorpay',
            status: 'SUCCESS',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('payments').doc(paymentDetails.id).set(paymentRecord);
        console.log('PAYMENT SAVED');

        return subData;
    }

    async isPaymentAlreadyUsed(paymentId) {
        const doc = await db.collection('payments').doc(paymentId).get();
        return doc.exists;
    }
}

module.exports = new PaymentService();
