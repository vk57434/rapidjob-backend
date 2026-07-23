const PaymentService = require('../services/PaymentService');
const { db } = require('../firebase-admin');

class PaymentController {
    async createOrder(req, res) {
        console.log("CREATE_ORDER_STARTED");
        console.log("Request Body:", req.body);
        console.log("User:", req.user);

        const { planId } = req.body;
        const uid = req.user.uid;
        const role = req.user.role;

        try {
            console.log("Calling Cashfree Service...");
            const order = await PaymentService.createOrder(uid, planId, role);
            console.log("Cashfree Service Response:", order);

            // Maintain Android response format
            const responseData = {
                success: true,
                order_id: order.order_id,
                payment_session_id: order.payment_session_id
            };

            console.log("Sending Response To Android:", responseData);
            res.json(responseData);
        } catch (error) {
            console.error('[CASHFREE_ERROR] Create Order:', error);
            res.status(500).json({
                success: false,
                message: error.message,
                stack: error.stack
            });
        }
    }

    async webhook(req, res) {
        const signature = req.headers['x-cf-signature'];
        const timestamp = req.headers['x-cf-timestamp'];
        const rawBody = req.body; // Buffer (due to express.raw)

        console.log('[CASHFREE_WEBHOOK_RECEIVED]', {
            headers: req.headers,
            isBuffer: Buffer.isBuffer(rawBody),
            bodyLength: rawBody?.length
        });

        // 1. Detect Cashfree Dashboard Connectivity Test (no headers)
        if (!signature && !timestamp) {
            console.log('[CASHFREE_WEBHOOK] Dashboard validation request received.');
            return res.status(200).send('OK (Connectivity Test)');
        }

        // 2. Validate Production Webhook Headers
        if (!signature || !timestamp) {
            console.error('[CASHFREE_ERROR] Missing production headers');
            return res.status(400).send('Missing headers');
        }

        if (!rawBody || rawBody.length === 0) {
            console.error('[CASHFREE_ERROR] Empty request body');
            return res.status(400).send('Empty body');
        }

        try {
            // Manual verification (v2023-08-01 format)
            const isValid = PaymentService.verifyWebhookSignature(signature, rawBody.toString('utf-8'), timestamp);

            if (!isValid) {
                console.error('[CASHFREE_ERROR] Invalid Signature');
                return res.status(400).send('Invalid Signature');
            }
            console.log('[CASHFREE_SIGNATURE_VALID]');

            const body = JSON.parse(rawBody.toString('utf-8'));

            if (body.data?.event === 'PAYMENT_SUCCESS_WEBHOOK') {
                const payment = body.data.payment;
                const order = body.data.order;

                // Idempotency
                const isProcessed = await PaymentService.isPaymentAlreadyUsed(payment.cf_payment_id);
                if (isProcessed) {
                    console.warn('[CASHFREE_DUPLICATE_WEBHOOK]', payment.cf_payment_id);
                    return res.status(200).send('Already processed');
                }

                // Metadata lookup
                const metaDoc = await db.collection('order_metadata').doc(order.order_id).get();
                if (!metaDoc.exists) throw new Error('Order metadata not found');
                const meta = metaDoc.data();

                await PaymentService.activateSubscription(meta.uid, meta.planId, payment, meta.role);
                console.log('[CASHFREE_PAYMENT_VERIFIED] Subscription activated');
            }

            res.status(200).send('OK');
        } catch (err) {
            console.error('[CASHFREE_ERROR] Webhook processing:', err);
            res.status(500).send('Internal Error');
        }
    }

    async getStatus(req, res) {
        const { orderId } = req.params;
        try {
            const payments = await PaymentService.getPaymentStatus(orderId);
            const successPayment = payments.find(p => p.payment_status === 'SUCCESS');
            res.json({
                success: true,
                status: successPayment ? 'SUCCESS' : (payments.length > 0 ? payments[0].payment_status : 'PENDING')
            });
        } catch (error) {
            console.error('[CASHFREE_ERROR] Get Status:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new PaymentController();
