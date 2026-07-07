const { db } = require('../config/firebaseAdmin');

class UserController {
    async getProfile(req, res) {
        try {
            const uid = req.user.uid;
            const doc = await db.collection('users').doc(uid).get();
            if (!doc.exists) return res.status(404).json({ error: 'User not found' });
            res.json(doc.data());
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateProfile(req, res) {
        try {
            const uid = req.user.uid;
            const updates = req.body;
            await db.collection('users').doc(uid).update(updates);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new UserController();
