const { db } = require('../firebase-admin');

class NotificationController {
    async getNotifications(req, res) {
        try {
            const uid = req.user.uid;
            const snapshot = await db.collection('notifications')
                .where('userId', '==', uid)
                .orderBy('timestamp', 'desc')
                .get();

            const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            await db.collection('notifications').doc(id).update({ isRead: true });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new NotificationController();
