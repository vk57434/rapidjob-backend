const express = require('express');
const router = express.Router();
const WaApiController = require('../controllers/WaApiController');

router.get('/status', WaApiController.getWaapiStatus);

module.exports = router;
