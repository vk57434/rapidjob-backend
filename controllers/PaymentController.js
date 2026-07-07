const PaymentService = require('../services/PaymentService');
const { db, rtdb } = require('../config/firebaseAdmin');

class PaymentController {
    /**
     * POST /api/payment/create-order
     * Creates a Razorpay Order and returns order_id to Android.
     */
    async createOrder(req, res) {
        console.log('=== PAYMENT: CREATE ORDER REQUEST ===');
        console.log('Request Body:', JSON.stringify(req.body));
        console.log('User from JWT:', req.user ? { uid: req.user.uid, email: req.user.email } : 'Not authenticated');
        
        try {
            const { amount, currency, planId } = req.body;
            const uid = req.user.uid;

            // Validation
            if (!amount) {
                console.error('PAYMENT ERROR: Amount is missing from request');
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Amount is required'
                });
            }

            if (!planId) {
                console.error('PAYMENT ERROR: Plan ID is missing from request');
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Plan ID is required'
                });
            }

            if (!uid) {
                console.error('PAYMENT ERROR: User UID not found in JWT token');
                return res.status(401).json({
                    success: false,
                    stage: 'Authentication',
                    message: 'User not authenticated'
                });
            }

            console.log('PAYMENT: Creating order for UID:', uid, '| Amount:', amount, '| Currency:', currency || 'INR', '| Plan:', planId);

            // amount must be Integer (paise)
            const receipt = `rcpt_${uid}_${Date.now()}`;
            const order = await PaymentService.createOrder(parseInt(amount), currency || 'INR', receipt, planId);
            
            console.log('PAYMENT: Razorpay Order Created Successfully');
            console.log('Order ID:', order.id);
            console.log('Order Amount:', order.amount);
            console.log('Order Currency:', order.currency);

            // Return response with key_id for Android
            const response = {
                success: true,
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                receipt: order.receipt
            };

            console.log('PAYMENT: Sending response to Android:', JSON.stringify(response));
            res.json(response);
            
        } catch (error) {
            console.error('=== PAYMENT: ORDER CREATION ERROR ===');
            console.error('Error Stage: Razorpay API');
            console.error('Error Message:', error.message);
            console.error('Error Stack:', error.stack);
            
            res.status(500).json({
                success: false,
                stage: 'Razorpay API',
                message: error.message || 'Failed to create order'
            });
        }
    }

    /**
     * POST /api/payment/verify
     * Verifies payment signature and activates subscription.
     */
    async verify(req, res) {
        console.log('=== PAYMENT: VERIFICATION REQUEST ===');
        console.log('Request Body:', JSON.stringify(req.body));
        console.log('User from JWT:', req.user ? { uid: req.user.uid, email: req.user.email } : 'Not authenticated');
        
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
            const uid = req.user.uid;

            // Validation
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                console.error('PAYMENT ERROR: Missing verification parameters');
                console.error('razorpay_order_id:', razorpay_order_id ? 'Present' : 'Missing');
                console.error('razorpay_payment_id:', razorpay_payment_id ? 'Present' : 'Missing');
                console.error('razorpay_signature:', razorpay_signature ? 'Present' : 'Missing');
                
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Missing verification parameters'
                });
            }

            if (!uid) {
                console.error('PAYMENT ERROR: User UID not found in JWT token');
                return res.status(401).json({
                    success: false,
                    stage: 'Authentication',
                    message: 'User not authenticated'
                });
            }

            console.log('PAYMENT: Verifying signature for Order:', razorpay_order_id, '| Payment:', razorpay_payment_id);

            // Verify Signature
            const isValid = PaymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

            if (!isValid) {
                console.error('PAYMENT ERROR: Invalid Payment Signature');
                console.error('Order ID:', razorpay_order_id);
                console.error('Payment ID:', razorpay_payment_id);
                console.error('Signature:', razorpay_signature);
                
                return res.status(400).json({
                    success: false,
                    stage: 'Signature Verification',
                    message: 'Invalid signature'
                });
            }

            console.log('PAYMENT: Signature Verified Successfully | UID:', uid);

            // 1. Save payment record to Firestore
            console.log('PAYMENT: Saving payment record to Firestore...');
            const paymentRef = db.collection('payments').doc(razorpay_payment_id);
            await paymentRef.set({
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                userId: uid,
                planId: planId || 'premium_monthly',
                status: 'verified',
                gateway: 'razorpay',
                timestamp: new Date().toISOString()
            });
            console.log('PAYMENT: Payment record saved');

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

            console.log('PAYMENT: Subscription Data:', JSON.stringify(subscriptionData));

            // 3. Update Firestore (Atomic Write)
            console.log('PAYMENT: Updating Firestore subscriptions...');
            const batch = db.batch();
            batch.set(db.collection('subscriptions').doc(uid), subscriptionData);
            batch.set(db.collection('job_seeker_subscriptions').doc(uid), subscriptionData);
            await batch.commit();
            console.log('PAYMENT: Firestore updated successfully');

            // 4. Update RTDB for instant UI refresh
            console.log('PAYMENT: Updating RTDB for instant UI refresh...');
            await rtdb.ref(`subscriptions/${uid}`).set({
                isActive: true,
                expiryDate: expiry.getTime(),
                planId: planId || 'premium_monthly',
                updatedAt: Date.now()
            });
            console.log('PAYMENT: RTDB updated successfully');

            console.log('=== PAYMENT: SUBSCRIPTION ACTIVATED SUCCESSFULLY ===');
            console.log('UID:', uid);
            console.log('Plan:', planId || 'premium_monthly');
            console.log('Expiry:', expiry.toISOString());

            res.json({ 
                success: true, 
                message: 'Subscription activated successfully',
                subscription: subscriptionData
            });
            
        } catch (error) {
            console.error('=== PAYMENT: VERIFICATION ERROR ===');
            console.error('Error Stage: Fulfillment');
            console.error('Error Message:', error.message);
            console.error('Error Stack:', error.stack);
            
            res.status(500).json({
                success: false,
                stage: 'Fulfillment',
                message: error.message || 'Failed to verify payment'
            });
        }
    }
}

module.exports = new PaymentController();
