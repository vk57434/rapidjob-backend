const PaymentService = require('../services/PaymentService');
const { db, rtdb } = require('../config/firebaseAdmin');

class PaymentController {
    async createOrder(req, res) {
        console.log('Incoming createOrder request:', req.body);
        try {
            const { amount, currency, receipt } = req.body;

            if (!amount) {
                console.error('Missing amount in request');
                return res.status(400).json({ error: 'Amount is required' });
            }

            console.log(`Creating Razorpay order: amount=${amount}, currency=${currency}`);
            const order = await PaymentService.createOrder(amount, currency, receipt);
            console.log('Razorpay order created successfully:', order.id);
            res.json(order);
        } catch (error) {
            console.error('Razorpay Order Creation Error:', error);
            console.error('Stack Trace:', error.stack);
            res.status(500).json({
                error: 'Failed to create Razorpay order',
                details: error.message,
                code: error.code || 'RAZORPAY_ERROR'
            });
        }
    }

    async verify(req, res) {
        console.log('Incoming verification request:', req.body);
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
            const uid = req.user.uid;

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                console.error('Missing verification parameters');
                return res.status(400).json({ error: 'Missing verification parameters' });
            }

            console.log(`Verifying signature for order: ${razorpay_order_id}`);
            const isValid = PaymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

            if (isValid) {
                console.log('Signature valid. Activating subscription for user:', uid);

                // 1. Save payment to Firestore: /payments
                const paymentData = {
                    orderId: razorpay_order_id,
                    paymentId: razorpay_payment_id,
                    userId: uid,
                    planId: planId || 'default_plan',
                    status: 'verified',
                    gateway: 'razorpay',
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
                    isActive: true,
                    updatedAt: new Date().toISOString()
                };

                // Set in multiple possible collections for compatibility
                await db.collection('subscriptions').doc(uid).set(subscriptionData);
                await db.collection('job_seeker_subscriptions').doc(uid).set(subscriptionData);

                // 3. Update Realtime Database: /subscriptions/{uid}
                await rtdb.ref(`subscriptions/${uid}`).set({
                    isActive: true,
                    expiryDate: expiryDate.getTime(),
                    planId: planId || 'premium_monthly',
                    updatedAt: Date.now()
                });

                console.log('Subscription activated successfully');
                res.json({ success: true, message: 'Payment verified and subscription activated' });
            } else {
                console.warn('Invalid Razorpay signature detected');
                res.status(400).json({ error: 'Invalid signature' });
            }
        } catch (error) {
            console.error('Payment verification error:', error);
            console.error('Stack Trace:', error.stack);
            res.status(500).json({ error: 'Verification failed', details: error.message });
        }
    }
}

module.exports = new PaymentController();
