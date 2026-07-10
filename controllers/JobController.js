const { db } = require('../firebase-admin');

class JobController {
    async createJob(req, res) {
        console.log('====== JobController.createJob ======');
        try {
            const jobData = req.body;
            jobData.createdAt = new Date().toISOString();
            jobData.recruiterId = req.user.uid;
            jobData.recruiterUid = req.user.uid; // for compatibility
            console.log('Creating job with data:', JSON.stringify(jobData, null, 2));

            const docRef = await db.collection('jobs').add(jobData);
            console.log('Job created successfully with ID:', docRef.id);
            res.status(201).json({ id: docRef.id, ...jobData });
        } catch (error) {
            console.error('JobController.createJob ERROR:', error.message);
            console.error('Error stack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    }

    async getJobs(req, res) {
        console.log('====== JobController.getJobs ======');
        try {
            const { category } = req.query;
            console.log('Query params:', { category });

            let query = db.collection('jobs');

            if (category) {
                query = query.where('category', '==', category);
            }

            const snapshot = await query.orderBy('createdAt', 'desc').get();
            const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('Returning', jobs.length, 'jobs');
            res.json(jobs);
        } catch (error) {
            console.error('JobController.getJobs ERROR:', error.message);
            console.error('Error stack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    }

    async updateJob(req, res) {
        console.log('====== JobController.updateJob ======');
        try {
            const { id } = req.params;
            console.log('Updating job ID:', id, 'with data:', req.body);

            await db.collection('jobs').doc(id).update(req.body);
            console.log('Job updated successfully');
            res.json({ success: true });
        } catch (error) {
            console.error('JobController.updateJob ERROR:', error.message);
            console.error('Error stack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    }

    async deleteJob(req, res) {
        console.log('====== JobController.deleteJob ======');
        try {
            const { id } = req.params;
            console.log('Deleting job ID:', id);

            await db.collection('jobs').doc(id).delete();
            console.log('Job deleted successfully');
            res.json({ success: true });
        } catch (error) {
            console.error('JobController.deleteJob ERROR:', error.message);
            console.error('Error stack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new JobController();
