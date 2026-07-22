const axios = require('axios');
const crypto = require('crypto');
const { rtdb, db, admin } = require('../firebase-admin');

const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';

class PaymentService {
    constructor() {
        this.clientId = process.env.CASHFREE_CLIENT_ID;
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET;
        this.apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';

        console.log("[CASHFREE_INIT_SANDBOX]", {
            ENV: process.env.CASHFREE_ENV,
            URL: CASHFREE_BASE_URL,
            CLIENT_ID: this.clientId ? "SET" : "MISSING",
            API_VERSION: this.apiVersion
        });
    }

    getHeaders() {
        return {
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'x-api-version': this.apiVersion,
            'Content-Type': 'application/json'
        };
    }

    async createOrder(uid, planId, userRole) {
        console.log(`[CASHFREE_ORDER_START] UID: ${uid}, Plan: ${planId}`);
        
        const [planDoc, userDoc] = await Promise.all([
            db.collection('plans').doc(planId).get(),
            db.collection('users').doc(uid).get()
        ]);

        if (!planDoc.exists) throw new Error('Plan not found');
        const planData = planDoc.data();
        const userData = userDoc.exists ? userDoc.data() : { name: 'User', email: 'no-email@rapidjob.com', phone: '9999999999' };

        const amount = parseFloat(planData.price);
        const orderId = `ord_${uid.substring(0, 8)}_${Date.now()}`;

        await db.collection('order_metadata').doc(orderId).set({
            uid,
            planId,
            role: userRole,
            planName: planData.name,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const requestBody = {
            order_amount: amount,
            order_currency: 'INR',
            order_id: orderId,
            customer_details: {
                customer_id: uid,
                customer_name: (userData.name || 'User').substring(0, 30),
                customer_email: userData.email || 'no-email@rapidjob.com',
                customer_phone: (userData.phone || '9999999999').toString()
            },
            order_meta: {
                return_url: "https://www.cashfree.com/devguide/sdk/android/payments/return-url"
            }
        };

        try {
            console.log("[CASHFREE_API_REQUEST] POST", `${CASHFREE_BASE_URL}/orders`);
            console.log("[CASHFREE_API_BODY]", JSON.stringify(requestBody));

            const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, requestBody, {
                headers: this.getHeaders()
            });

            console.log("[CASHFREE_API_RESPONSE] Status:", response.status);
            console.log("[CASHFREE_API_DATA]", JSON.stringify(response.data));

            return response.data;
        } catch (error) {
            console.error("[CASHFREE_API_ERROR] Status:", error.response?.status);
            console.error("[CASHFREE_API_DATA]", JSON.stringify(error.response?.data));

            const errMsg = error.response?.data?.message || error.message;
            throw new Error(`Cashfree Order creation failed: ${errMsg}`);
        }
    }

    verifyWebhookSignature(signature, rawBody, timestamp) {
        try {
            // According to Cashfree v2023-08-01, the signature is a HMAC SHA256 of timestamp + rawBody using the clientSecret
            const secret = this.clientSecret;
            const data = timestamp + rawBody;
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(data)
                .digest('base64');

            return expectedSignature === signature;
        } catch (error) {
            console.error('[CASHFREE_WEBHOOK_VERIFY_ERROR]', error);
            return false;
        }
    }

    async getPaymentStatus(orderId) {
        try {
            const response = await axios.get(`${CASHFREE_BASE_URL}/orders/${orderId}/payments`, {
                headers: this.getHeaders()
            });
            return response.data;
        } catch (error) {
            console.error("[CASHFREE_STATUS_ERROR]", error.response?.data || error.message);
            throw new Error('Failed to fetch payment status');
        }
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
