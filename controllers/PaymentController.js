const PaymentService = require('../services/PaymentService');
const { db, rtdb } = require('../config/firebaseAdmin');

class PaymentController {
    /**
     * POST /api/payment/create-order
     * Creates a Razorpay Order and returns order_id to Android.
     */
    async createOrder(req, res) {
        console.log('Incoming Order Request:', req.body);
        try {
            const { amount, currency, receipt } = req.body;

            if (!amount) {
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Amount is required'
                });
            }

            // amount must be Integer (paise)
            const order = await PaymentService.createOrder(parseInt(amount), currency, receipt);
            console.log('Razorpay Order Created:', order.id);
            res.json(order);
        } catch (error) {
            console.error('Order Creation Error:', error);
            res.status(500).json({
                success: false,
                stage: 'Razorpay API',
                message: error.message
            });
        }
    }

    /**
     * POST /api/payment/verify
     * Verifies payment signature and activates subscription.
     */
    async verify(req, res) {
        console.log('Incoming Verification Request:', req.body);
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
            const uid = req.user.uid;

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Missing verification parameters'
                });
            }

            const isValid = PaymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

            if (!isValid) {
                console.warn('Invalid Payment Signature detected for order:', razorpay_order_id);
                return res.status(400).json({
                    success: false,
                    stage: 'Signature Verification',
                    message: 'Invalid signature'
                });
            }

            console.log('Payment Verified | UID:', uid);

            // 1. Save payment record
            const paymentRef = db.collection('payments').doc(razorpay_payment_id);
            await paymentRef.set({
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                userId: uid,
                planId: planId || 'default',
                status: 'verified',
                gateway: 'razorpay',
                timestamp: new Date().toISOString()
            });

            // 2. Calculate Expiry (30 days from now)
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30);

            const subscriptionData = {
                userId: uid,
                planId: planId || 'premium_monthly',
                startDate: new Date().toISOString(),
                expiryDate: expiry.toISOString(),
                isActive: true,
                updatedAt: new Date().toISOString()
            };

            // 3. Update Firestore (Atomic Write)
            const batch = db.batch();
            batch.set(db.collection('subscriptions').doc(uid), subscriptionData);
            batch.set(db.collection('job_seeker_subscriptions').doc(uid), subscriptionData);
            await batch.commit();

            // 4. Update RTDB for instant UI refresh
            await rtdb.ref(`subscriptions/${uid}`).set({
                isActive: true,
                expiryDate: expiry.getTime(),
                planId: planId || 'premium_monthly',
                updatedAt: Date.now()
            });

            res.json({ success: true, message: 'Subscription activated successfully' });
        } catch (error) {
            console.error('Verification Error:', error);
            res.status(500).json({
                success: false,
                stage: 'Fulfillment',
                message: error.message
            });
        }
    }
}

module.exports = new PaymentController();
