const { db } = require('../firebase-admin');

class NotificationService {
    async sendNotification(receiverUid, title, message, data = {}) {
        try {
            const notification = {
                receiverUid,
                title,
                message,
                payload: data,
                readStatus: false,
                createdAt: new Date()
            };
            return await db.collection('notifications').add(notification);
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    async getNotifications(userId) {
        const snapshot = await db.collection('notifications')
            .where('receiverUid', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}

module.exports = new NotificationService();
