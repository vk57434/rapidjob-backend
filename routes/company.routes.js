const express = require('express');
const router = express.Router();
const CompanyController = require('../controllers/CompanyController');
const { verifyToken } = require('../middlewares/auth');

router.get('/:recruiterId', CompanyController.getCompany);
router.put('/', verifyToken, CompanyController.updateCompany);

module.exports = router;
