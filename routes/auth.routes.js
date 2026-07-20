const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const WaApiController = require('../controllers/WaApiController');

// OTP Flow
router.post('/send-otp', AuthController.sendOtp);
router.post('/verify-otp', AuthController.verifyOtp);

// WhatsApp OTP Flow
router.post('/send-whatsapp-otp', WaApiController.sendWhatsappOtp);
router.post('/verify-whatsapp-otp', WaApiController.verifyWhatsappOtp);

// Keep existing routes if needed, but the controller was overwritten
// so they should be added back to the controller if needed.
// router.post('/register', AuthController.register);
// router.post('/login', AuthController.login);

module.exports = router;
