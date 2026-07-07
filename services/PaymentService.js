const razorpay = require('../config/razorpay');
const crypto = require('crypto');

class PaymentService {
    async createOrder(amount, currency = 'INR', receipt = 'receipt_1') {
        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency,
            receipt
        };
        return await razorpay.orders.create(options);
    }

    verifySignature(orderId, paymentId, signature) {
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
        return generatedSignature === signature;
    }
}

module.exports = new PaymentService();
