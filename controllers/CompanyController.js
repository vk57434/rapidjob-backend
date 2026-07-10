const { db } = require('../firebase-admin');

class CompanyController {
    async getCompany(req, res) {
        try {
            const { recruiterId } = req.params;
            const snapshot = await db.collection('companies').where('recruiterId', '==', recruiterId).get();
            if (snapshot.empty) return res.status(404).json({ error: 'Company not found' });

            const company = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            res.json(company);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateCompany(req, res) {
        try {
            const uid = req.user.uid;
            const companyData = req.body;

            const snapshot = await db.collection('companies').where('recruiterId', '==', uid).get();
            if (snapshot.empty) {
                // Create new
                await db.collection('companies').add({ ...companyData, recruiterId: uid });
            } else {
                // Update existing
                await db.collection('companies').doc(snapshot.docs[0].id).update(companyData);
            }

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new CompanyController();
