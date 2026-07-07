const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const { verifyToken } = require('../middlewares/auth');

router.post('/create-order', verifyToken, PaymentController.createOrder);
router.post('/verify', verifyToken, PaymentController.verify);

module.exports = router;
