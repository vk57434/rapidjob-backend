const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middlewares/auth');
const { db } = require('../config/firebaseAdmin');

/**
 * ADMIN ONLY ROUTES
 * Requirement: Protect backend APIs so only ADMIN role can call admin-only endpoints.
 */

router.get('/stats', verifyToken, isAdmin, async (req, res) => {
    try {
        console.log('[ADMIN] Fetching dashboard stats...');

        const usersCount = (await db.collection('users').count().get()).data().count;
        const jobsCount = (await db.collection('jobs').count().get()).data().count;
        const applicationsCount = (await db.collection('applications').count().get()).data().count;

        res.json({
            success: true,
            data: {
                totalUsers: usersCount,
                totalJobs: jobsCount,
                totalApplications: applicationsCount,
                serverTime: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[ADMIN] Stats Error:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
    }
});

module.exports = router;
