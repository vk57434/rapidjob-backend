const express = require('express');
const router = express.Router();
const JobController = require('../controllers/JobController');
const { verifyToken } = require('../middlewares/auth');

router.get('/', JobController.getJobs);
router.post('/', verifyToken, JobController.createJob);
router.put('/:id', verifyToken, JobController.updateJob);
router.delete('/:id', verifyToken, JobController.deleteJob);

module.exports = router;
