const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { verifyToken } = require('../middlewares/auth');

router.get('/', verifyToken, NotificationController.getNotifications);
router.put('/:id/read', verifyToken, NotificationController.markAsRead);

module.exports = router;
