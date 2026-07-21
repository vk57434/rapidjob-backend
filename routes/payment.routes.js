const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const { verifyToken } = require('./../middlewares/auth');

router.post('/create-order', verifyToken, PaymentController.createOrder);
router.post('/webhook', PaymentController.webhook);
router.get('/status/:orderId', verifyToken, PaymentController.getStatus);

module.exports = router;
