const PaymentService = require('../services/PaymentService');

class PaymentController {
    async createOrder(req, res) {
        const uid = req.user.uid;
        try {
            const { amount, currency, planId } = req.body;

            if (!amount || !planId) {
                return res.status(400).json({ success: false, message: '400 Invalid Request' });
            }

            const receipt = `rcpt_${uid.substring(0, 8)}_${Date.now()}`;
            const order = await PaymentService.createOrder(amount, currency || 'INR', receipt, planId);
            
            res.json({
                success: true,
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID
            });
        } catch (error) {
            console.error('FAILED: createOrder', error.message);
            res.status(500).json({ success: false, message: '500 Internal Error' });
        }
    }

    async verify(req, res) {
        const uid = req.user.uid;
        console.log(`[PAYMENT_VERIFY_START] UID: ${uid}`);
        
        try {
            // REQUEST VALIDATION
            const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planId } = req.body;

            // Log parameters before processing
            console.log('[VERIFY_PARAMS_RECEIVED]', {
                planId,
                paymentId: razorpayPaymentId,
                orderId: razorpayOrderId,
                signatureReceived: !!razorpaySignature
            });

            if (!razorpayOrderId) return res.status(400).json({ success: false, message: 'Missing razorpayOrderId' });
            if (!razorpayPaymentId) return res.status(400).json({ success: false, message: 'Missing razorpayPaymentId' });
            if (!razorpaySignature) return res.status(400).json({ success: false, message: 'Missing razorpaySignature' });
            if (!planId) return res.status(400).json({ success: false, message: 'Missing planId' });

            // 1. SIGNATURE VERIFICATION
            const isValid = PaymentService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!isValid) {
                console.error('[VERIFY_FAILED] Signature mismatch for Order:', razorpayOrderId);
                return res.status(403).json({ success: false, message: 'Invalid payment signature' });
            }
            console.log('[SIGNATURE_VERIFIED] OK');

            // 2. PREVENT DUPLICATE PROCESSING (REPLAY ATTACK PROTECTION)
            const alreadyProcessed = await PaymentService.isPaymentAlreadyUsed(razorpayPaymentId);
            if (alreadyProcessed) {
                console.error(`[VERIFY_FAILED] Payment ${razorpayPaymentId} was already successfully processed`);
                return res.status(409).json({ success: false, message: 'Payment already processed and subscription activated' });
            }

            // 3. FETCH PAYMENT FROM RAZORPAY API
            const paymentDetails = await PaymentService.getPaymentDetails(razorpayPaymentId);
            console.log(`[RAZORPAY_API_FETCH] Status: ${paymentDetails.status}, Amount: ${paymentDetails.amount}`);

            if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
                console.error(`[VERIFY_FAILED] Payment status is ${paymentDetails.status}, expected captured/authorized`);
                return res.status(400).json({ success: false, message: `Payment not successful (Status: ${paymentDetails.status})` });
            }

            // 4. LOAD PLAN DETAILS FROM FIRESTORE (DYNAMIC LOOKUP)
            const planDetails = await PaymentService.getPlanDetails(planId);
            if (!planDetails) {
                console.error(`[VERIFY_FAILED] Plan document not found in Firestore for ID: ${planId}`);
                return res.status(404).json({
                    success: false,
                    message: 'Plan document not found. Please contact support if payment was debited.'
                });
            }
            console.log(`[PLAN_LOADED] Name: ${planDetails.planName}, Category determines Recruiter: ${planDetails.isRecruiter}`);

            // 5. ACTIVATE SUBSCRIPTION (UPDATE RTDB, FIRESTORE & HISTORY)
            // This is a complex operation that updates multiple data sources
            const subscription = await PaymentService.activateSubscription(
                uid,
                planId,
                planDetails,
                paymentDetails,
                req.user.role // Pass role from middleware
            );

            console.log('[VERIFY_SUCCESS] Subscription activated for UID:', uid);
            res.json({
                success: true,
                message: 'Subscription activated successfully',
                subscription
            });

        } catch (error) {
            console.error('[VERIFY_CRITICAL_FAILURE] Trace:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during payment verification. Payment recorded for manual review.'
            });
        }
    }
}

module.exports = new PaymentController();
