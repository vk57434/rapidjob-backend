const express = require('express');
const router = express.Router();
const SubscriptionController = require('../controllers/SubscriptionController');
const { verifyToken } = require('../middlewares/auth');

router.get('/plans', SubscriptionController.getPlans);
router.get('/my', verifyToken, SubscriptionController.getMySubscription);

module.exports = router;
