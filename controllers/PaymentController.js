const PaymentService = require('../services/PaymentService');
const { db } = require('../firebase-admin');

class PaymentController {
    async createOrder(req, res) {
        console.log("[CASHFREE_CREATE_ORDER_API] Started");
        const { planId } = req.body;
        const uid = req.user.uid;
        const role = req.user.role;

        if (!planId) {
            return res.status(400).json({ success: false, message: "planId is required" });
        }

        try {
            const order = await PaymentService.createOrder(uid, planId, role);

            // Response format for Android SDK compatibility
            res.json({
                success: true,
                order_id: order.order_id,
                payment_session_id: order.payment_session_id
            });
        } catch (error) {
            console.error('[CASHFREE_API_ERROR] Create Order:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async webhook(req, res) {
        // Support both latest and legacy Cashfree headers
        const signature = req.headers['x-webhook-signature'] || req.headers['x-cf-signature'];
        const timestamp = req.headers['x-webhook-timestamp'] || req.headers['x-cf-timestamp'];
        const rawBody = req.body; // Expecting a Buffer from express.raw

        console.log('[CASHFREE_WEBHOOK_RECEIVED]', {
            timestamp,
            hasSignature: !!signature,
            isBuffer: Buffer.isBuffer(rawBody),
            bodyLength: rawBody?.length,
            contentType: req.headers['content-type']
        });

        // 1. Detect Cashfree Dashboard Connectivity Test (no headers)
        if (!signature && !timestamp) {
            console.log('[CASHFREE_WEBHOOK] Connectivity Test / Dashboard Validation.');
            return res.status(200).send('OK');
        }

        if (!rawBody || rawBody.length === 0) {
            console.error('[CASHFREE_WEBHOOK_ERROR] Empty request body');
            return res.status(400).send('Empty body');
        }

        try {
            // 2. Signature verification (passing the raw Buffer to the service)
            const isValid = PaymentService.verifyWebhookSignature(signature, rawBody, timestamp);

            if (!isValid) {
                return res.status(400).send('Invalid Signature');
            }

            const body = JSON.parse(rawBody.toString('utf-8'));
            const eventType = body.type || body.data?.event;
            console.log(`[CASHFREE_EVENT] ${eventType}`);

            if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || eventType === 'payment.success') {
                const payment = payload.data.payment;
                const order = payload.data.order;

                // Idempotency check inside activateSubscription
                const metaDoc = await db.collection('order_metadata').doc(order.order_id).get();
                if (!metaDoc.exists) {
                    console.error(`[CASHFREE_ERROR] Metadata not found for order: ${order.order_id}`);
                    return res.status(200).send('Metadata missing, but OK (will retry or use status check)');
                }

                const meta = metaDoc.data();
                console.log(`[CASHFREE_ORDER_METADATA_FOUND] UID: ${meta.uid}`);

                await PaymentService.activateSubscription(meta.uid, meta.planId, payment, meta.role);
            }

            res.status(200).send('OK');
        } catch (err) {
            console.error('[CASHFREE_WEBHOOK_FAILED]', err);
            res.status(500).send('Internal Error');
        }
    }

    /**
     * Enhanced status check with auto-activation
     */
    async getStatus(req, res) {
        const { orderId } = req.params;
        console.log(`[CASHFREE_STATUS_CHECK] OrderID: ${orderId}`);

        try {
            const payments = await PaymentService.getPaymentStatus(orderId);
            const successPayment = payments.find(p => p.payment_status === 'SUCCESS');

            if (successPayment) {
                // If payment is SUCCESS, ensure subscription is activated (Self-Healing)
                const isProcessed = await PaymentService.isPaymentAlreadyUsed(successPayment.cf_payment_id);

                if (!isProcessed) {
                    console.log("[CASHFREE_SELF_HEALING] Payment is SUCCESS but not activated. Activating now...");
                    const metaDoc = await db.collection('order_metadata').doc(orderId).get();

                    if (metaDoc.exists) {
                        const meta = metaDoc.data();
                        await PaymentService.activateSubscription(meta.uid, meta.planId, successPayment, meta.role);
                        return res.json({
                            success: true,
                            status: 'SUCCESS',
                            subscriptionActivated: true
                        });
                    }
                }

                return res.json({
                    success: true,
                    status: 'SUCCESS',
                    subscriptionActivated: true
                });
            }

            // If not successful yet
            const currentStatus = payments.length > 0 ? payments[0].payment_status : 'PENDING';
            res.json({
                success: true,
                status: currentStatus,
                subscriptionActivated: false
            });

        } catch (error) {
            console.error(`[CASHFREE_STATUS_API_ERROR] Order: ${orderId}`, error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new PaymentController();
