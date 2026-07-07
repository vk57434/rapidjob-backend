const { db } = require('../config/firebaseAdmin');

class UserController {
    async getProfile(req, res) {
        console.log('====== UserController.getProfile ======');
        try {
            const uid = req.user.uid;
            console.log('📖 Reading user profile for UID:', uid);
            const doc = await db.collection('users').doc(uid).get();
            if (!doc.exists) {
                console.log('⚠️ User not found for UID:', uid);
                return res.status(404).json({ error: 'User not found' });
            }
            const userData = doc.data();
            console.log('✅ User profile found:', JSON.stringify(userData, null, 2));
            res.json(userData);
        } catch (error) {
            console.error('❌ UserController.getProfile ERROR:', error.message, '\nStack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    }

    async updateProfile(req, res) {
        console.log('====== UserController.updateProfile ======');
        try {
            const uid = req.user.uid;
            const updates = req.body;
            console.log('✍️ Updating user profile for UID:', uid, '| Updates:', JSON.stringify(updates, null, 2));
            await db.collection('users').doc(uid).update(updates);
            console.log('✅ User profile updated successfully for UID:', uid);
            res.json({ success: true });
        } catch (error) {
            console.error('❌ UserController.updateProfile ERROR:', error.message, '\nStack:', error.stack);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new UserController();
