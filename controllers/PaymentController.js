const PaymentService = require('../services/PaymentService');
const { db, rtdb } = require('../config/firebaseAdmin');

class PaymentController {
    async createOrder(req, res) {
        console.log('Incoming createOrder request:', req.body);

        try {
            const { amount, currency = 'INR', receipt } = req.body;

            if (!amount) {
                return res.status(400).json({
                    error: 'Amount is required'
                });
            }

            const order = await PaymentService.createOrder(
                amount,
                currency,
                receipt
            );

            console.log('Razorpay order created:', order.id);

            return res.json(order);

        } catch (error) {
            console.error('Razorpay Order Creation Error:', error);

            return res.status(500).json({
                error: 'Failed to create Razorpay order',
                details: error.message
            });
        }
    }

    async verify(req, res) {
        console.log('Incoming verification request:', req.body);

        try {
            const {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                planId
            } = req.body;

            const uid = req.user.uid;

            if (
                !razorpay_order_id ||
                !razorpay_payment_id ||
                !razorpay_signature
            ) {
                return res.status(400).json({
                    error: 'Missing verification parameters'
                });
            }

            const isValid = PaymentService.verifySignature(
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            );

            if (!isValid) {
                return res.status(400).json({
                    error: 'Invalid signature'
                });
            }

            const paymentData = {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                userId: uid,
                planId: planId || 'premium_monthly',
                gateway: 'razorpay',
                status: 'verified',
                timestamp: new Date().toISOString()
            };

            await db.collection('payments').add(paymentData);

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            const subscriptionData = {
                userId: uid,
                planId: planId || 'premium_monthly',
                startDate: new Date().toISOString(),
                expiryDate: expiryDate.toISOString(),
                isActive: true,
                updatedAt: new Date().toISOString()
            };

            await db.collection('subscriptions').doc(uid).set(subscriptionData);

            await db.collection('job_seeker_subscriptions').doc(uid).set(subscriptionData);

            await rtdb.ref(`subscriptions/${uid}`).set({
                isActive: true,
                expiryDate: expiryDate.getTime(),
                planId: planId || 'premium_monthly',
                updatedAt: Date.now()
            });

            return res.json({
                success: true,
                message: 'Payment verified and subscription activated'
            });

        } catch (error) {
            console.error('Payment verification error:', error);

            return res.status(500).json({
                error: 'Verification failed',
                details: error.message
            });
        }
    }
}

module.exports = new PaymentController();