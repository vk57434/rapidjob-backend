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
            const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planId } = req.body;

            console.log(`[VERIFY_REQUEST] OrderId: ${razorpayOrderId}, PaymentId: ${razorpayPaymentId}, PlanId: ${planId}`);

            if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !planId) {
                console.error('[VERIFY_FAILED] Missing required fields');
                return res.status(400).json({ success: false, message: 'Missing payment details' });
            }

            // 1. Signature Verification
            const isValid = PaymentService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!isValid) {
                console.error('[VERIFY_FAILED] Signature mismatch');
                return res.status(403).json({ success: false, message: 'Invalid payment signature' });
            }
            console.log('[SIGNATURE_VERIFIED] OK');

            // 2. Prevent Replay Attacks (Check if payment was already processed)
            const alreadyProcessed = await PaymentService.isPaymentAlreadyUsed(razorpayPaymentId);
            if (alreadyProcessed) {
                console.error(`[VERIFY_FAILED] Payment ${razorpayPaymentId} already used`);
                return res.status(409).json({ success: false, message: 'Payment already processed' });
            }

            // 3. Verify Payment Status with Razorpay API
            const paymentDetails = await PaymentService.getPaymentDetails(razorpayPaymentId);
            console.log(`[PAYMENT_STATUS] Status: ${paymentDetails.status}`);

            if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
                console.error(`[VERIFY_FAILED] Payment status: ${paymentDetails.status}`);
                return res.status(400).json({ success: false, message: `Payment not successful (Status: ${paymentDetails.status})` });
            }

            // 4. Load Plan Details
            let planDetails;
            try {
                planDetails = PaymentService.getPlanDetails(planId);
                console.log(`[PLAN_LOADED] Name: ${planDetails.planName}, isRecruiter: ${planDetails.isRecruiter}`);
            } catch (e) {
                console.error(`[VERIFY_FAILED] Plan not found: ${planId}`);
                return res.status(404).json({ success: false, message: 'Selected plan details not found' });
            }

            // 5. Activate Subscription (Update RTDB, Firestore & History)
            const subscription = await PaymentService.activateSubscription(
                uid,
                planId,
                planDetails,
                paymentDetails
            );

            console.log('[VERIFY_SUCCESS] Subscription activated');
            res.json({
                success: true,
                message: 'Subscription activated successfully',
                subscription
            });

        } catch (error) {
            console.error('[VERIFY_CRITICAL_FAILURE]', error);
            res.status(500).json({ success: false, message: error.message || 'Internal server error during verification' });
        }
    }
}

module.exports = new PaymentController();
