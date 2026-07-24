const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { verifyToken } = require('../middlewares/auth');

// Protect AI routes
router.post('/generate', verifyToken, aiController.generateResumeContent);

module.exports = router;
