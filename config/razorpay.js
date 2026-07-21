const Razorpay = require('razorpay');
const dotenv = require('dotenv');

dotenv.config();
console.log("=================================");
console.log("KEY ID:", process.env.RAZORPAY_KEY_ID);
console.log("SECRET EXISTS:", !!process.env.RAZORPAY_KEY_SECRET);
console.log("SECRET LENGTH:", process.env.RAZORPAY_KEY_SECRET?.length);
console.log("=================================");
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

module.exports = razorpay;
