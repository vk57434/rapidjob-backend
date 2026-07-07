const PaymentService = require('../services/PaymentService');
const { db, rtdb } = require('../config/firebaseAdmin');

class PaymentController {
    async createOrder(req, res) {
<<<<<<< HEAD
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
=======
        try {
            const { amount, currency, receipt } = req.body;
            const order = await PaymentService.createOrder(amount, currency, receipt);
            res.json(order);
        } catch (error) {
            res.status(500).json({ error: error.message });
>>>>>>> d581ed586963667aefc688765f2ea8927a117896
        }
    }

    async verify(req, res) {
<<<<<<< HEAD
        console.log('Incoming verification request:', req.body);
=======
>>>>>>> d581ed586963667aefc688765f2ea8927a117896
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
            const uid = req.user.uid;

<<<<<<< HEAD
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                console.error('Missing verification parameters');
                return res.status(400).json({ error: 'Missing verification parameters' });
            }

            console.log(`Verifying signature for order: ${razorpay_order_id}`);
            const isValid = PaymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

            if (isValid) {
                console.log('Signature valid. Activating subscription for user:', uid);

=======
            const isValid = PaymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

            if (isValid) {
>>>>>>> d581ed586963667aefc688765f2ea8927a117896
                // 1. Save payment to Firestore: /payments
                const paymentData = {
                    orderId: razorpay_order_id,
                    paymentId: razorpay_payment_id,
                    userId: uid,
                    planId: planId || 'default_plan',
                    status: 'verified',
<<<<<<< HEAD
                    gateway: 'razorpay',
=======
>>>>>>> d581ed586963667aefc688765f2ea8927a117896
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
<<<<<<< HEAD
                    isActive: true,
                    updatedAt: new Date().toISOString()
                };

                // Set in multiple possible collections for compatibility
                await db.collection('subscriptions').doc(uid).set(subscriptionData);
                await db.collection('job_seeker_subscriptions').doc(uid).set(subscriptionData);
=======
                    isActive: true
                };
                await db.collection('subscriptions').doc(uid).set(subscriptionData);
>>>>>>> d581ed586963667aefc688765f2ea8927a117896

                // 3. Update Realtime Database: /subscriptions/{uid}
                await rtdb.ref(`subscriptions/${uid}`).set({
                    isActive: true,
                    expiryDate: expiryDate.getTime(),
<<<<<<< HEAD
                    planId: planId || 'premium_monthly',
                    updatedAt: Date.now()
                });

                console.log('Subscription activated successfully');
                res.json({ success: true, message: 'Payment verified and subscription activated' });
            } else {
                console.warn('Invalid Razorpay signature detected');
=======
                    planId: planId || 'premium_monthly'
                });

                res.json({ success: true, message: 'Payment verified and subscription activated' });
            } else {
>>>>>>> d581ed586963667aefc688765f2ea8927a117896
                res.status(400).json({ error: 'Invalid signature' });
            }
        } catch (error) {
            console.error('Payment verification error:', error);
<<<<<<< HEAD
            console.error('Stack Trace:', error.stack);
            res.status(500).json({ error: 'Verification failed', details: error.message });
=======
            res.status(500).json({ error: error.message });
>>>>>>> d581ed586963667aefc688765f2ea8927a117896
        }
    }
}

module.exports = new PaymentController();
