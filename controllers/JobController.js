const { db } = require('../config/firebaseAdmin');

class JobController {
    async createJob(req, res) {
        try {
            const jobData = req.body;
            jobData.createdAt = new Date().toISOString();
            jobData.recruiterId = req.user.uid;
            const docRef = await db.collection('jobs').add(jobData);
            res.status(201).json({ id: docRef.id, ...jobData });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getJobs(req, res) {
        try {
            const { category } = req.query;
            let query = db.collection('jobs');

            if (category) {
                query = query.where('category', '==', category);
            }

            const snapshot = await query.orderBy('createdAt', 'desc').get();
            const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(jobs);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateJob(req, res) {
        try {
            const { id } = req.params;
            await db.collection('jobs').doc(id).update(req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteJob(req, res) {
        try {
            const { id } = req.params;
            await db.collection('jobs').doc(id).delete();
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new JobController();
