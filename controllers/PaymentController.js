const PaymentService = require('../services/PaymentService');
const { db, rtdb } = require('../config/firebaseAdmin');

class PaymentController {
    async createOrder(req, res) {
        try {
            const { amount, currency, receipt } = req.body;
            const order = await PaymentService.createOrder(amount, currency, receipt);
            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async verify(req, res) {
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
            const uid = req.user.uid;

            const isValid = PaymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

            if (isValid) {
                // 1. Save payment to Firestore: /payments
                const paymentData = {
                    orderId: razorpay_order_id,
                    paymentId: razorpay_payment_id,
                    userId: uid,
                    planId: planId || 'default_plan',
                    status: 'verified',
                    timestamp: new Date().toISOString()
                };
                await db.collection('payments').add(paymentData);

                // 2. Activate Subscription in Firestore: /subscriptions
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 30); // Default 30 days

                const subscriptionData = {
                    userId: uid,
                    planId: planId || 'premium_monthly',
                    startDate: new Date().toISOString(),
                    expiryDate: expiryDate.toISOString(),
                    isActive: true
                };
                await db.collection('subscriptions').doc(uid).set(subscriptionData);

                // 3. Update Realtime Database: /subscriptions/{uid}
                await rtdb.ref(`subscriptions/${uid}`).set({
                    isActive: true,
                    expiryDate: expiryDate.getTime(),
                    planId: planId || 'premium_monthly'
                });

                res.json({ success: true, message: 'Payment verified and subscription activated' });
            } else {
                res.status(400).json({ error: 'Invalid signature' });
            }
        } catch (error) {
            console.error('Payment verification error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new PaymentController();
