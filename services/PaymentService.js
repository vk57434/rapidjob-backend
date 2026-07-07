const razorpay = require('../config/razorpay');
const crypto = require('crypto');

class PaymentService {
    async createOrder(amount, currency = 'INR', receipt = `rcpt_${Date.now()}`, planId) {
        console.log('=== PAYMENT SERVICE: CREATE ORDER ===');
        
        // Ensure amount is in paise
        const orderAmount = Math.round(amount);
        console.log('PaymentService: Creating order');
        console.log('Amount:', orderAmount, 'paise (₹', orderAmount / 100, ')');
        console.log('Currency:', currency);
        console.log('Receipt:', receipt);
        console.log('Plan ID:', planId);

        // Validate Razorpay credentials
        if (!process.env.RAZORPAY_KEY_ID) {
            console.error('PAYMENT SERVICE ERROR: RAZORPAY_KEY_ID is not configured');
            throw new Error('Razorpay Key ID is not configured in environment variables');
        }

        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error('PAYMENT SERVICE ERROR: RAZORPAY_KEY_SECRET is not configured');
            throw new Error('Razorpay Key Secret is not configured in environment variables');
        }

        console.log('PAYMENT SERVICE: Razorpay credentials validated');
        console.log('Key ID:', process.env.RAZORPAY_KEY_ID.substring(0, 8) + '...');

        const options = {
            amount: orderAmount,
            currency,
            receipt,
            notes: {
                planId: planId || 'premium_monthly'
            }
        };

        console.log('PAYMENT SERVICE: Calling Razorpay API with options:', JSON.stringify(options));

        try {
            const order = await razorpay.orders.create(options);
            
            console.log('PAYMENT SERVICE: Razorpay Order Created Successfully');
            console.log('Order ID:', order.id);
            console.log('Order Entity:', order.entity);
            console.log('Order Amount:', order.amount);
            console.log('Order Currency:', order.currency);
            console.log('Order Status:', order.status);
            
            return order;
        } catch (error) {
            console.error('=== PAYMENT SERVICE: RAZORPAY SDK ERROR ===');
            console.error('Error Type:', error.error?.type || 'Unknown');
            console.error('Error Code:', error.error?.code || 'Unknown');
            console.error('Error Description:', error.error?.description || error.message);
            console.error('Error Stack:', error.stack);
            
            // Provide user-friendly error messages
            if (error.error?.code === 'BAD_REQUEST_ERROR') {
                throw new Error('Invalid payment request. Please check the amount and try again.');
            } else if (error.error?.code === 'SERVER_ERROR') {
                throw new Error('Razorpay server error. Please try again later.');
            } else if (error.error?.code === 'GATEWAY_ERROR') {
                throw new Error('Payment gateway error. Please try again later.');
            } else {
                throw new Error(error.message || 'Failed to create payment order');
            }
        }
    }

    verifySignature(orderId, paymentId, signature) {
        console.log('=== PAYMENT SERVICE: VERIFY SIGNATURE ===');
        console.log('Order ID:', orderId);
        console.log('Payment ID:', paymentId);
        console.log('Signature:', signature ? signature.substring(0, 20) + '...' : 'Missing');

        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error('PAYMENT SERVICE ERROR: RAZORPAY_KEY_SECRET is missing for verification');
            return false;
        }

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        console.log('PAYMENT SERVICE: Generated Signature:', generatedSignature);
        console.log('PAYMENT SERVICE: Received Signature:', signature);
        console.log('PAYMENT SERVICE: Signature Match:', generatedSignature === signature);

        const isValid = generatedSignature === signature;
        
        if (isValid) {
            console.log('PAYMENT SERVICE: Signature Verification SUCCESS');
        } else {
            console.error('PAYMENT SERVICE: Signature Verification FAILED');
        }

        return isValid;
    }
}

module.exports = new PaymentService();