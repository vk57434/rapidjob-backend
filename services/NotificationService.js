const { db } = require('../config/firebaseAdmin');

class NotificationService {
    async sendNotification(userId, title, message, data = {}) {
        try {
            const notification = {
                userId,
                title,
                message,
                data,
                isRead: false,
                timestamp: new Date().toISOString()
            };
            return await db.collection('notifications').add(notification);
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    async getNotifications(userId) {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}

module.exports = new NotificationService();
