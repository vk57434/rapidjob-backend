const razorpay = require('../config/razorpay');
const crypto = require('crypto');

class PaymentService {
    async createOrder(amount, currency = 'INR', receipt = `rcpt_${Date.now()}`) {
        // Ensure amount is in paise
        const orderAmount = Math.round(amount);

        console.log(`PaymentService: Creating order for ${orderAmount} ${currency}`);

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay keys are not configured in environment variables');
        }

        const options = {
            amount: orderAmount,
            currency,
            receipt
        };

        try {
            const order = await razorpay.orders.create(options);
            return order;
        } catch (error) {
            console.error('Razorpay SDK Error:', error);
            throw error;
        }
    }

    verifySignature(orderId, paymentId, signature) {
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error('RAZORPAY_KEY_SECRET is missing for verification');
            return false;
        }

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        return generatedSignature === signature;
    }
}

module.exports = new PaymentService();