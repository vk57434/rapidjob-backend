const express = require('express');
const router = express.Router();
const EmailController = require('../controllers/EmailController');
const { verifyToken } = require('../middlewares/auth');

/**
 * Email Routes
 * All routes require authentication
 */

// Send job application notification to recruiter
router.post('/job-application', verifyToken, EmailController.sendJobApplicationNotification);

// Send welcome email (future use)
router.post('/welcome', verifyToken, EmailController.sendWelcomeEmail);

module.exports = router;
