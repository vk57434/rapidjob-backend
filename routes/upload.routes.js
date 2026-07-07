const express = require('express');
const router = express.Router();
const UploadController = require('../controllers/UploadController');
const { verifyToken } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.post('/profile-photo', verifyToken, upload.single('image'), UploadController.uploadProfilePhoto);
router.post('/company-logo', verifyToken, upload.single('image'), UploadController.uploadCompanyLogo);
router.post('/resume', verifyToken, upload.single('file'), UploadController.uploadResume);

module.exports = router;
