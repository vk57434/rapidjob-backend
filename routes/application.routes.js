const express = require('express');
const router = express.Router();
const ApplicationController = require('../controllers/ApplicationController');
const { verifyToken } = require('../middlewares/auth');

router.post('/', verifyToken, ApplicationController.apply);
router.get('/', verifyToken, ApplicationController.getApplications);

module.exports = router;
