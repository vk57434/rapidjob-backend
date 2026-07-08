const PaymentService = require('../services/PaymentService');
const { db, rtdb } = require('../config/firebaseAdmin');

class PaymentController {
    /**
     * POST /api/payment/create-order
     * Creates a Razorpay Order and returns order_id to Android.
     */
    async createOrder(req, res) {
        const uid = req.user.uid;
        console.log(`[PAYMENT] createOrder | UID: ${uid} | User: ${req.user.email}`);
        
        try {
            const { amount, currency, planId } = req.body;

            if (!amount || !planId) {
                console.error('[PAYMENT] Validation Error: amount or planId missing');
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Amount and Plan ID are required'
                });
            }

            console.log(`[PAYMENT] Creating order | Amount: ${amount} | Currency: ${currency || 'INR'} | Plan: ${planId}`);

            const receipt = `rcpt_${uid.substring(0, 8)}_${Date.now()}`;
            const order = await PaymentService.createOrder(parseInt(amount), currency || 'INR', receipt, planId);
            
            const response = {
                success: true,
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                receipt: order.receipt
            };

            console.log('[PAYMENT] Order Created Successfully:', order.id);
            res.json(response);
            
        } catch (error) {
            console.error('[PAYMENT] Order Creation Error:', error.message);
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
        const uid = req.user.uid;
        console.log(`[PAYMENT] verify | UID: ${uid} | User: ${req.user.email}`);
        
        try {
            const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planId } = req.body;

            if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
                console.error('[PAYMENT] Missing verification parameters');
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Missing verification parameters'
                });
            }

            console.log(`[PAYMENT] Verifying signature | Order: ${razorpayOrderId} | Payment: ${razorpayPaymentId}`);

            const isValid = PaymentService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

            if (!isValid) {
                console.error('[PAYMENT] Invalid Payment Signature');
                return res.status(400).json({
                    success: false,
                    stage: 'Signature Verification',
                    message: 'Invalid signature'
                });
            }

            console.log(`[PAYMENT] Signature Verified | Activating plan: ${planId}`);

            // 1. Determine plan details
            let durationDays = 30;
            let maxJobPosts = 5;
            let planName = 'Premium';

            // Recruiter Plans
            if (planId.includes('monthly')) { planName = 'Monthly Plan'; durationDays = 30; maxJobPosts = 10; }
            else if (planId.includes('quarterly')) { planName = 'Quarterly Plan'; durationDays = 90; maxJobPosts = 40; }
            else if (planId.includes('yearly')) { planName = 'Yearly Plan'; durationDays = 365; maxJobPosts = 200; }
            // Job Seeker Plans
            else if (planId === 'silver') { planName = 'Silver Plan'; durationDays = 30; maxJobPosts = 0; }
            else if (planId === 'gold') { planName = 'Gold Plan'; durationDays = 90; maxJobPosts = 0; }
            else if (planId === 'platinum') { planName = 'Platinum Plan'; durationDays = 365; maxJobPosts = 0; }

            const expiry = new Date();
            expiry.setDate(expiry.getDate() + durationDays);

            // 2. Save payment record
            await db.collection('payments').doc(razorpayPaymentId).set({
                orderId: razorpayOrderId,
                paymentId: razorpayPaymentId,
                userId: uid,
                planId: planId,
                status: 'verified',
                gateway: 'razorpay',
                timestamp: new Date().toISOString()
            });

            // 3. Update User Subscriptions in Firestore
            const subData = {
                userId: uid,
                planId: planId,
                planName: planName,
                status: 'ACTIVE',
                maxJobPosts: maxJobPosts,
                remainingJobPosts: maxJobPosts,
                startDate: new Date().toISOString(),
                expiryDate: expiry.toISOString(),
                isActive: true,
                updatedAt: new Date().toISOString()
            };

            const batch = db.batch();

            // Check if it's a recruiter plan or seeker plan based on ID
            const isRecruiterPlan = !(['silver', 'gold', 'platinum'].includes(planId));

            if (isRecruiterPlan) {
                batch.set(db.collection('recruiterSubscriptions').doc(uid), subData);
            } else {
                batch.set(db.collection('jobSeekerSubscriptions').doc(uid), subData);
            }

            // Generic subscriptions collection for shared lookups
            batch.set(db.collection('subscriptions').doc(uid), subData);

            await batch.commit();
            console.log('[PAYMENT] Firestore updated');

            // 4. Update RTDB for instant refresh
            await rtdb.ref(`subscriptions/${uid}`).set({
                isActive: true,
                status: 'ACTIVE',
                planId: planId,
                planName: planName,
                maxJobPosts: maxJobPosts,
                remainingJobs: maxJobPosts,
                expiryDate: expiry.getTime(),
                updatedAt: Date.now()
            });
            console.log('[PAYMENT] RTDB updated');

            res.json({ 
                success: true, 
                message: 'Subscription activated successfully',
                subscription: subData
            });
            
        } catch (error) {
            console.error('[PAYMENT] Verification/Activation Error:', error.message);
            res.status(500).json({
                success: false,
                stage: 'Fulfillment',
                message: error.message || 'Failed to verify payment'
            });
        }
    }
}

module.exports = new PaymentController();
