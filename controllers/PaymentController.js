const PaymentService = require('../services/PaymentService');
const { db } = require('../firebase-admin');

class PaymentController {
    async createOrder(req, res) {
        const { planId } = req.body;
        const uid = req.user.uid;
        const role = req.user.role;

        try {
            const order = await PaymentService.createOrder(uid, planId, role);
            res.json({
                success: true,
                order_id: order.order_id,
                payment_session_id: order.payment_session_id
            });
        } catch (error) {
            console.error('[CASHFREE_ERROR] Create Order:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async webhook(req, res) {
        const signature = req.headers['x-cf-signature'];
        const rawBody = req.body.toString();

        console.log('[CASHFREE_WEBHOOK_RECEIVED]');

        if (!PaymentService.verifyWebhookSignature(signature, rawBody)) {
            console.error('[CASHFREE_ERROR] Invalid Signature');
            return res.status(403).send('Invalid Signature');
        }
        console.log('[CASHFREE_SIGNATURE_VALID]');

        const body = JSON.parse(rawBody);

        if (body.data?.event === 'PAYMENT_SUCCESS_WEBHOOK') {
            const payment = body.data.payment;
            const order = body.data.order;

            try {
                // Verify payment status officially
                if (payment.payment_status !== 'SUCCESS') {
                    return res.status(200).send('Ignored non-success status');
                }

                // Get metadata from db
                const metaDoc = await db.collection('order_metadata').doc(order.order_id).get();
                if (!metaDoc.exists) throw new Error('Order metadata not found');
                const meta = metaDoc.data();

                // Idempotency
                const isProcessed = await PaymentService.isPaymentAlreadyUsed(payment.cf_payment_id);
                if (isProcessed) {
                    console.warn('[CASHFREE_DUPLICATE_WEBHOOK]');
                    return res.status(200).send('Already processed');
                }

                await PaymentService.activateSubscription(meta.uid, meta.planId, payment);
                console.log('[CASHFREE_PAYMENT_VERIFIED]');
            } catch (err) {
                console.error('[CASHFREE_ERROR] Webhook processing:', err);
                return res.status(500).send('Internal Error');
            }
        }

        res.status(200).send('OK');
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
