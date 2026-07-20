const express = require('express');
const router = express.Router();
const OtpController = require('../controllers/OtpController');

/**
 * OTP Routes
 * Base Path: /api/otp
 */

router.post('/send', OtpController.sendOtp);
router.post('/verify', OtpController.verifyOtp);

module.exports = router;
