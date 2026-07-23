const axios = require('axios');
const crypto = require('crypto');
const { rtdb, db, admin } = require('../firebase-admin');

const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || 'https://api.cashfree.com/pg';

// ─── TEMPORARY PRODUCTION TEST CONFIG ──────────────────────────────────────────
const ENABLE_TEMP_PRODUCTION_TEST = true; // Set to FALSE to revert prices
const TEMP_TEST_PRICE = 2; // Fixed price in INR for testing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PaymentService - Production Ready Cashfree Integration
 */
class PaymentService {
    constructor() {
        this.clientId = process.env.CASHFREE_CLIENT_ID;
        this.clientSecret = process.env.CASHFREE_CLIENT_SECRET;
        this.apiVersion = process.env.CASHFREE_API_VERSION || '2023-08-01';

        console.log("[CASHFREE_INIT_PRODUCTION]", {
            ENV: process.env.CASHFREE_ENV || 'PRODUCTION',
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

    // ─────────────────────────────────────────────────────────────────────────────
    // UTILITY HELPERS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Recursively removes all undefined and null values from an object.
     * Prevents Firebase "value argument contains undefined" errors.
     */
    removeUndefinedFields(obj) {
        if (obj === null || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => this.removeUndefinedFields(item));
        }

        return Object.fromEntries(
            Object.entries(obj)
                .filter(([_, v]) => v !== undefined && v !== null)
                .map(([k, v]) => [k, this.removeUndefinedFields(v)])
        );
    }

    /**
     * Extracts essential payment fields from various Cashfree webhook formats.
     */
    extractPaymentFields(payload) {
        const paymentId =
            payload?.cf_payment_id ??
            payload?.payment_id ??
            payload?.payment?.cf_payment_id ??
            payload?.payment?.payment_id ??
            payload?.data?.payment?.cf_payment_id ??
            payload?.data?.payment?.payment_id;

        const orderId =
            payload?.order_id ??
            payload?.cf_order_id ??
            payload?.order?.order_id ??
            payload?.payment?.order_id ??
            payload?.data?.order?.order_id ??
            payload?.data?.payment?.order_id ??
            null;

        const amount =
            payload?.payment_amount ??
            payload?.order_amount ??
            payload?.payment?.payment_amount ??
            payload?.data?.payment?.payment_amount ??
            0;

        const status = payload?.payment_status ?? payload?.payment?.payment_status ?? payload?.data?.payment?.payment_status ?? "SUCCESS";

        return { paymentId, orderId, amount, status };
    }

    /**
     * Validates that all required fields for subscription activation are present.
     */
    validatePayment(uid, planId, paymentId, amount) {
        if (!uid) throw new Error("[CASHFREE_VALIDATION_ERROR] Missing userId (uid).");
        if (!planId) throw new Error("[CASHFREE_VALIDATION_ERROR] Missing planId.");
        if (!paymentId) throw new Error("[CASHFREE_VALIDATION_ERROR] Missing paymentId.");
        if (parseFloat(amount) <= 0) throw new Error(`[CASHFREE_VALIDATION_ERROR] Invalid amount: ${amount}`);

        console.log("[CASHFREE_VALIDATION_SUCCESS]");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ORDER MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────────

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

            // TEMPORARY PRODUCTION TEST PLAN - REVERT AFTER PAYMENT TEST
            let amount = parseFloat(planData.totalPayable || planData.price);
            if (ENABLE_TEMP_PRODUCTION_TEST && planId === 'multiple_hire_annual') {
                console.log(`[CASHFREE_TEST_MODE] Overriding price for ${planId} to ₹${TEMP_TEST_PRICE}`);
                amount = TEMP_TEST_PRICE;
            }

            const orderId = `ord_${uid.substring(0, 8)}_${Date.now()}`;

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
                    return_url: "https://www.cashfree.com/devguide/sdk/android/payments/return-url",
                    payment_methods: ""
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

    // ─────────────────────────────────────────────────────────────────────────────
    // WEBHOOK & ACTIVATION
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Verifies the webhook signature for Cashfree API v2023-08-01 (Production & Sandbox)
     * Uses byte-perfect Buffer concatenation to ensure byte-perfect signature matching.
     */
    verifyWebhookSignature(signature, rawBody, timestamp) {
        try {
            if (!signature || !timestamp || !rawBody) {
                console.error("[CASHFREE_SIGNATURE_ERROR] Missing signature, timestamp, or body");
                return false;
            }

            // 1. Log verification start details (Production safe)
            console.log("[CASHFREE_VERIFICATION_START]", {
                timestamp,
                isBuffer: Buffer.isBuffer(rawBody),
                bodyLength: rawBody.length,
                signaturePrefix: signature.substring(0, 8)
            });

            // 2. Implementation: HMAC-SHA256(timestamp + raw_body, secret_key)
            // We use Buffers directly to avoid any encoding/whitespace issues during string conversion
            const timestampBuffer = Buffer.from(timestamp, 'utf8');
            const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

            const data = Buffer.concat([timestampBuffer, bodyBuffer]);

            const expectedSignature = crypto
                .createHmac('sha256', this.clientSecret)
                .update(data)
                .digest('base64');

            // 3. Debug logging for comparison
            console.log("[CASHFREE_SIGNATURE_COMPARISON]", {
                received: signature,
                calculated: expectedSignature
            });

            // 4. Timing-safe comparison to prevent side-channel attacks
            const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
            const receivedBuffer = Buffer.from(signature, 'utf8');

            if (expectedBuffer.length !== receivedBuffer.length) {
                console.error("[CASHFREE_SIGNATURE_INVALID] Length mismatch");
                return false;
            }

            const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

            if (isValid) {
                console.log("[CASHFREE_SIGNATURE_VALID]");
            } else {
                console.error("[CASHFREE_SIGNATURE_INVALID] Content mismatch. Check Production Secret Key.");
            }

            return isValid;
        } catch (error) {
            console.error('[CASHFREE_WEBHOOK_VERIFY_ERROR]', error);
            return false;
        }
    }

    /**
     * Core logic to activate subscription across Firestore and RTDB.
     * Features Idempotency, Retries, and Null-Safety.
     */
    async activateSubscription(uid, planId, rawPayload, userRole = null) {
        console.log("[CASHFREE_WEBHOOK_PAYLOAD]", JSON.stringify(rawPayload, null, 2));

        const { paymentId, orderId, amount, status } = this.extractPaymentFields(rawPayload);

        console.log("[CASHFREE_FIELDS]", { uid, planId, paymentId, orderId, amount, status });

        if (status === 'SUCCESS') {
            console.log(`[CASHFREE_PAYMENT_SUCCESS] PaymentID: ${paymentId}`);
        }

        // 1. Idempotency Check
        const isProcessed = await this.isPaymentAlreadyUsed(paymentId);
        if (isProcessed) {
            console.warn(`[CASHFREE_ALREADY_PROCESSED] Payment: ${paymentId}.`);
            return { success: true, alreadyProcessed: true };
        }

        // 2. Validation
        try {
            this.validatePayment(uid, planId, paymentId, amount);
        } catch (err) {
            console.error("[CASHFREE_WEBHOOK_ERROR]", err.message);
            throw err;
        }

        try {
            // 3. Fetch Plan Details
            const planDoc = await db.collection('plans').doc(planId).get();
            if (!planDoc.exists) throw new Error(`Plan ${planId} not found in Firestore`);
            const planData = planDoc.data();

            const now = Date.now();
            const durationDays = planData.durationDays || planData.duration || 0;
            const expiry = durationDays > 0 ? now + (durationDays * 24 * 60 * 60 * 1000) : 0;

            // 4. Build Data Models
            const subData = this.removeUndefinedFields({
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
            });

            const paymentRecord = this.removeUndefinedFields({
                paymentId,
                transactionId: paymentId,
                orderId,
                planId,
                planName: planData.name,
                gateway: 'CASHFREE',
                amount: parseFloat(amount),
                currency: 'INR',
                paymentStatus: status,
                purchaseDate: now,
                expiryDate: expiry,
                userId: uid,
                status: 'SUCCESS', // Firestore field
                timestamp: admin.firestore.FieldValue.serverTimestamp() // Firestore field
            });

            // 5. Database Execution with Retry Logic
            let firestoreSuccess = false;
            let rtdbSuccess = false;

            // --- Firestore Operation ---
            const performFirestore = async () => {
                const collection = (userRole === 'JOB_SEEKER' || planId.startsWith('seeker_')) ? 'jobSeekerSubscriptions' : 'subscriptions';
                await db.collection(collection).doc(uid).set({
                    ...subData,
                    expiryAt: expiry > 0 ? admin.firestore.Timestamp.fromMillis(expiry) : null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                await db.collection('payments').doc(paymentId).set(paymentRecord);
                firestoreSuccess = true;
                console.log("[CASHFREE_FIRESTORE_UPDATED]");
                console.log("[CASHFREE_PAYMENT_HISTORY_UPDATED]");
            };

            // --- RTDB Operation ---
            const performRTDB = async () => {
                await rtdb.ref(`subscriptions/${uid}`).set(subData);
                await rtdb.ref(`payments/${uid}/${paymentId}`).set(paymentRecord);
                rtdbSuccess = true;
                console.log("[CASHFREE_RTDB_UPDATED]");
            };

            // Execute both
            try { await performFirestore(); } catch (e) { console.error("[CASHFREE_FIRESTORE_FAIL]", e.message); }
            try { await performRTDB(); } catch (e) { console.error("[CASHFREE_RTDB_FAIL]", e.message); }

            // Cross-Database Retries
            if (firestoreSuccess && !rtdbSuccess) {
                console.log("[CASHFREE_RETRY] Retrying RTDB...");
                try { await performRTDB(); } catch (e) { console.error("[CASHFREE_RTDB_RETRY_FAILED]", e.message); }
            }
            if (rtdbSuccess && !firestoreSuccess) {
                console.log("[CASHFREE_RETRY] Retrying Firestore...");
                try { await performFirestore(); } catch (e) { console.error("[CASHFREE_FIRESTORE_RETRY_FAILED]", e.message); }
            }

            if (!firestoreSuccess && !rtdbSuccess) {
                throw new Error("Both databases failed to update.");
            }

            console.log("[CASHFREE_SUBSCRIPTION_ACTIVATED] UID:", uid);
            console.log("[CASHFREE_WEBHOOK_COMPLETE]");
            return { success: true, subData };

        } catch (error) {
            console.error("[CASHFREE_WEBHOOK_ERROR]", error.message);
            throw error;
        }
    }

    async getPaymentStatus(orderId) {
        try {
            const response = await axios.get(`${CASHFREE_BASE_URL}/orders/${orderId}/payments`, {
                headers: this.getHeaders()
            });
            return response.data;
        } catch (error) {
            console.error(`[CASHFREE_STATUS_ERROR] Order: ${orderId}`, error.response?.data || error.message);
            throw error;
        }
    }

    async isPaymentAlreadyUsed(paymentId) {
        if (!paymentId) return false;
        try {
            const doc = await db.collection('payments').doc(paymentId).get();
            return doc.exists;
        } catch (e) {
            return false;
        }
    }
}

module.exports = new PaymentService();
