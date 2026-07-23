const axios = require('axios');
const crypto = require('crypto');
const { rtdb, db, admin } = require('../firebase-admin');

const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg';

class PaymentService {
    constructor() {
        this.clientId = process.env.CASHFREE_CLIENT_ID;
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET;
        this.apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';

        console.log("[CASHFREE_INIT]", {
            ENV: process.env.CASHFREE_ENV || 'SANDBOX',
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
        console.log(`[CASHFREE_ORDER_START] UID: ${uid}, Plan: ${planId}, Role: ${userRole}`);
        
        try {
            const [planDoc, userDoc] = await Promise.all([
                db.collection('plans').doc(planId).get(),
                db.collection('users').doc(uid).get()
            ]);

            if (!planDoc.exists) throw new Error(`Plan ${planId} not found`);
            const planData = planDoc.data();
            const userData = userDoc.exists ? userDoc.data() : { name: 'User', email: 'no-email@rapidjob.com', phone: '9999999999' };

            // Use totalPayable (inclusive of GST) if available, fallback to price
            const amount = parseFloat(planData.totalPayable || planData.price);
            const orderId = `ord_${uid.substring(0, 8)}_${Date.now()}`;

            // Save metadata for webhook/status recovery
            await db.collection('order_metadata').doc(orderId).set({
                uid,
                planId,
                role: userRole || (planId.startsWith('seeker_') ? 'JOB_SEEKER' : 'RECRUITER'),
                planName: planData.name,
                amount: amount,
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

            const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, requestBody, {
                headers: this.getHeaders()
            });

            console.log(`[CASHFREE_ORDER_CREATED] OrderID: ${orderId}`);
            return response.data;
        } catch (error) {
            console.error("[CASHFREE_ORDER_ERROR]", error.response?.data || error.message);
            throw new Error(`Cashfree Order failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Verifies the webhook signature for Cashfree API v2023-08-01
     */
    verifyWebhookSignature(signature, rawBody, timestamp) {
        try {
            if (!signature || !timestamp || !rawBody) return false;

            const data = timestamp + rawBody;
            const expectedSignature = crypto
                .createHmac('sha256', this.clientSecret)
                .update(data)
                .digest('base64');

            const isValid = expectedSignature === signature;
            if (isValid) {
                console.log("[CASHFREE_SIGNATURE_VALID]");
            } else {
                console.error("[CASHFREE_SIGNATURE_INVALID]", {
                    received: signature,
                    expected: expectedSignature,
                    timestamp: timestamp
                });
            }
            return isValid;
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
            return response.data; // This is an array of payment objects
        } catch (error) {
            console.error(`[CASHFREE_STATUS_ERROR] Order: ${orderId}`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Production-ready activation logic with idempotency and cross-database sync
     */
    async activateSubscription(uid, planId, paymentDetails, userRole = null) {
        const paymentId = paymentDetails.cf_payment_id || paymentDetails.payment_id;
        console.log(`[CASHFREE_ACTIVATION_START] UID: ${uid}, Plan: ${planId}, Payment: ${paymentId}`);

        // 1. Idempotency Check (Prevent duplicate activation)
        const isProcessed = await this.isPaymentAlreadyUsed(paymentId);
        if (isProcessed) {
            console.warn(`[CASHFREE_ALREADY_PROCESSED] Payment: ${paymentId}. Skipping activation.`);
            return { alreadyProcessed: true };
        }

        try {
            // 2. Fetch Plan Details
            const planDoc = await db.collection('plans').doc(planId).get();
            if (!planDoc.exists) {
                console.error(`[CASHFREE_ERROR] Plan ${planId} not found in Firestore`);
                throw new Error('Plan not found');
            }
            const planData = planDoc.data();

            const now = Date.now();
            const durationDays = planData.durationDays || planData.duration || 0;
            const expiry = durationDays > 0 ? now + (durationDays * 24 * 60 * 60 * 1000) : 0;

            const subData = {
                userId: uid,
                planId: planId,
                planName: planData.name,
                status: 'ACTIVE',
                remainingJobs: planData.maxJobPosts || 0,
                jobsLimit: planData.maxJobPosts || 0,
                expiryDate: expiry,
                purchaseDate: now,
                paymentId: paymentId,
                paymentGateway: 'CASHFREE',
                active: true,
                updatedAt: now
            };

            // 3. Update RTDB (Immediate Dashboard Sync)
            const rtdbTasks = [
                rtdb.ref(`subscriptions/${uid}`).set({ ...subData }),
                rtdb.ref(`payments/${uid}/${paymentId}`).set({
                    paymentId: paymentId,
                    transactionId: paymentId,
                    orderId: paymentDetails.order_id,
                    planId: planId,
                    planName: planData.name,
                    gateway: 'CASHFREE',
                    amount: paymentDetails.order_amount || paymentDetails.payment_amount,
                    currency: 'INR',
                    paymentStatus: 'SUCCESS',
                    purchaseDate: now,
                    expiryDate: expiry
                })
            ];

            await Promise.all(rtdbTasks);
            console.log("[CASHFREE_RTDB_UPDATED]");

            // 4. Update Firestore
            let collection = 'subscriptions'; // Default recruiter
            if (userRole === 'JOB_SEEKER') {
                collection = 'jobSeekerSubscriptions';
            } else if (!userRole) {
                // Fallback: check if plan is seeker plan
                const isRecruiter = (planData.maxJobPosts && planData.maxJobPosts > 0) || !planId.startsWith('seeker_');
                collection = isRecruiter ? 'subscriptions' : 'jobSeekerSubscriptions';
            }

            const firestoreTasks = [
                // Update Subscription
                db.collection(collection).doc(uid).set({
                    ...subData,
                    expiryAt: expiry > 0 ? admin.firestore.Timestamp.fromMillis(expiry) : null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true }),

                // Record Payment
                db.collection('payments').doc(paymentId).set({
                    id: paymentId,
                    orderId: paymentDetails.order_id,
                    userId: uid,
                    amount: paymentDetails.order_amount || paymentDetails.payment_amount,
                    currency: 'INR',
                    planId,
                    planName: planData.name,
                    gateway: 'CASHFREE',
                    status: 'SUCCESS',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                })
            ];

            await Promise.all(firestoreTasks);
            console.log(`[CASHFREE_FIRESTORE_UPDATED] Collection: ${collection}`);

            console.log(`[CASHFREE_ACTIVATION_COMPLETE] UID: ${uid}, Payment: ${paymentId}`);
            return { success: true, subData };
        } catch (error) {
            console.error(`[CASHFREE_ACTIVATION_FAILED] UID: ${uid}`, error);
            throw error;
        }
    }

    async isPaymentAlreadyUsed(paymentId) {
        if (!paymentId) return false;
        const doc = await db.collection('payments').doc(paymentId).get();
        return doc.exists;
    }
}

module.exports = new PaymentService();
