const { db } = require('../config/firebaseAdmin');

class ApplicationController {
    async apply(req, res) {
        console.log('====== ApplicationController.apply ======');
        try {
            const { jobId, resumeUrl, coverLetter } = req.body;
            const uid = req.user.uid;
            console.log('Request Body:', JSON.stringify(req.body, null, 2));
            console.log('Applying for jobId:', jobId, 'from candidate:', uid);

            const application = {
                jobId,
                candidateId: uid,
                jobSeekerId: uid, // for compatibility
                recruiterId: null, // we'll fill this later by fetching the job
                resumeUrl,
                coverLetter,
                status: 'applied',
                appliedAt: new Date().toISOString()
            };

            // First fetch the job to get recruiterId
            const jobDoc = await db.collection('jobs').doc(jobId).get();
            if (jobDoc.exists) {
                const jobData = jobDoc.data();
                application.recruiterId = jobData.recruiterId || jobData.recruiterUid;
            }

            const docRef = await db.collection('applications').add(application);
            console.log('Application created successfully, ID:', docRef.id);
            res.status(201).json({ id: docRef.id, ...application });
        } catch (error) {
            console.error('ApplicationController.apply ERROR:', error.message);
            console.error('Error stack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    }

    async getApplications(req, res) {
        console.log('====== ApplicationController.getApplications ======');
        try {
            const uid = req.user.uid;
            const role = req.user.role;
            console.log('Fetching applications for user:', uid, 'with role:', role);

            let query = db.collection('applications');
            if (role === 'JOB_SEEKER') {
                console.log('Fetching for job seeker');
                query = query.where('candidateId', '==', uid);
            } else if (role === 'RECRUITER') {
                console.log('Fetching for recruiter');
                const jobsSnapshot = await db.collection('jobs').where('recruiterId', '==', uid).get();
                const jobIds = jobsSnapshot.docs.map(doc => doc.id);
                console.log('Recruiter has jobIds:', jobIds);

                if (jobIds.length === 0) {
                    return res.json([]);
                }

                query = query.where('jobId', 'in', jobIds);
            }

            const snapshot = await query.get();
            const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('Returning', applications.length, 'applications');
            res.json(applications);
        } catch (error) {
            console.error('ApplicationController.getApplications ERROR:', error.message);
            console.error('Error stack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ApplicationController();
