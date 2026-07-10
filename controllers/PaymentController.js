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
        console.log('PAYMENT START');
        
        try {
            const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planId } = req.body;

            if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !planId) {
                return res.status(400).json({ success: false, message: '400 Invalid Request' });
            }

            // 1. Signature Verification
            const isValid = PaymentService.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!isValid) {
                console.error('FAILED: Invalid Signature');
                return res.status(403).json({ success: false, message: '403 Invalid Signature' });
            }
            console.log('SIGNATURE VERIFIED');

            // 2. Prevent Replay Attacks (Check if payment was already processed)
            const alreadyProcessed = await PaymentService.isPaymentAlreadyUsed(razorpayPaymentId);
            if (alreadyProcessed) {
                console.error('FAILED: Payment already processed');
                return res.status(409).json({ success: false, message: '409 Payment already processed' });
            }

            // 3. Verify Payment Status with Razorpay API
            const paymentDetails = await PaymentService.getPaymentDetails(razorpayPaymentId);
            if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
                console.error('FAILED: Payment not captured');
                return res.status(400).json({ success: false, message: '400 Payment not captured' });
            }
            console.log('PAYMENT VERIFIED');

            // 4. Load Plan Details
            let planDetails;
            try {
                planDetails = PaymentService.getPlanDetails(planId);
                console.log('PLAN LOADED');
            } catch (e) {
                console.error('FAILED: Plan Not Found');
                return res.status(404).json({ success: false, message: '404 Plan Not Found' });
            }

            // 5. Check for Existing Active Subscription
            const activeSub = await PaymentService.getActiveSubscription(uid);
            if (activeSub && activeSub.planId === planId) {
                console.log('FAILED: Already Active');
                return res.status(409).json({ success: false, message: '409 Already Active' });
            }

            // 6. Activate Subscription (Update RTDB & History)
            const subscription = await PaymentService.activateSubscription(
                uid,
                planId,
                planDetails,
                paymentDetails
            );

            console.log('SUCCESS');
            res.json({
                success: true,
                message: 'Subscription activated successfully',
                subscription
            });

        } catch (error) {
            console.error('FAILED: verify', error.message);
            res.status(500).json({ success: false, message: '500 Internal Error' });
        }
    }
}

module.exports = new PaymentController();
