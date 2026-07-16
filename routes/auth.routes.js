const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

// OTP Flow
router.post('/send-otp', AuthController.sendOtp);
router.post('/verify-otp', AuthController.verifyOtp);

// Keep existing routes if needed, but the controller was overwritten
// so they should be added back to the controller if needed.
// router.post('/register', AuthController.register);
// router.post('/login', AuthController.login);

module.exports = router;
