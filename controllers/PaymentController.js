const PaymentService = require('../services/PaymentService');

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
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async webhook(req, res) {
        const signature = req.headers['x-cf-signature'];
        const body = req.body;

        if (!PaymentService.verifyWebhookSignature(signature, JSON.stringify(body))) {
            return res.status(403).send('Invalid Signature');
        }

        if (body.data.event === 'PAYMENT_SUCCESS_WEBHOOK') {
            const payment = body.data.payment;
            const order = body.data.order;
            const meta = JSON.parse(order.order_note);

            const isProcessed = await PaymentService.isPaymentAlreadyUsed(payment.cf_payment_id);
            if (!isProcessed) {
                await PaymentService.activateSubscription(meta.uid, meta.planId, payment);
            }
        }
        res.status(200).send('OK');
    }

    async getStatus(req, res) {
        const { orderId } = req.params;
        try {
            const payments = await PaymentService.getPaymentStatus(orderId);
            const successPayment = payments.find(p => p.payment_status === 'SUCCESS');
            res.json({ success: true, status: successPayment ? 'SUCCESS' : 'PENDING' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new PaymentController();
