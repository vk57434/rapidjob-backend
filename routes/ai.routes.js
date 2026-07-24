const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Protect AI routes
router.post('/generate', authMiddleware, aiController.generateResumeContent);

module.exports = router;
