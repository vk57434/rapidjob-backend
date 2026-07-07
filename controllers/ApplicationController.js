const { db } = require('../config/firebaseAdmin');

class ApplicationController {
    async apply(req, res) {
        try {
            const { jobId, resumeUrl, coverLetter } = req.body;
            const uid = req.user.uid;

            const application = {
                jobId,
                candidateId: uid,
                resumeUrl,
                coverLetter,
                status: 'applied',
                appliedAt: new Date().toISOString()
            };

            const docRef = await db.collection('applications').add(application);
            res.status(201).json({ id: docRef.id, ...application });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getApplications(req, res) {
        try {
            const uid = req.user.uid;
            const role = req.user.role;

            let query = db.collection('applications');
            if (role === 'candidate') {
                query = query.where('candidateId', '==', uid);
            } else if (role === 'recruiter') {
                // For recruiters, they should see applications for their jobs
                // This usually requires a different query structure or fetching their jobs first
                const jobsSnapshot = await db.collection('jobs').where('recruiterId', '==', uid).get();
                const jobIds = jobsSnapshot.docs.map(doc => doc.id);

                if (jobIds.length === 0) return res.json([]);

                query = query.where('jobId', 'in', jobIds);
            }

            const snapshot = await query.get();
            const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(applications);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ApplicationController();
