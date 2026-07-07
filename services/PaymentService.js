const razorpay = require('../config/razorpay');
const crypto = require('crypto');

class PaymentService {
<<<<<<< HEAD
    async createOrder(amount, currency = 'INR', receipt = `rcpt_${Date.now()}`) {
        // Ensure amount is an integer (paise)
        const orderAmount = Math.round(amount);

        console.log(`PaymentService: Creating order for ${orderAmount} ${currency}`);

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay keys are not configured in environment variables');
        }

        const options = {
            amount: orderAmount, // amount in the smallest currency unit (paise)
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

=======
    async createOrder(amount, currency = 'INR', receipt = 'receipt_1') {
        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency,
            receipt
        };
        return await razorpay.orders.create(options);
    }

    verifySignature(orderId, paymentId, signature) {
>>>>>>> d581ed586963667aefc688765f2ea8927a117896
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
<<<<<<< HEAD

=======
>>>>>>> d581ed586963667aefc688765f2ea8927a117896
        return generatedSignature === signature;
    }
}

module.exports = new PaymentService();
