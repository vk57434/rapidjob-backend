const { db, admin } = require('../config/firebaseAdmin');

class SubscriptionService {
    async getUserSubscription(userId) {
        const doc = await db.collection('subscriptions').doc(userId).get();
        return doc.exists ? doc.data() : null;
    }

    async updateSubscription(userId, planId, durationInDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + durationInDays);

        const subscriptionData = {
            planId,
            userId,
            startDate: new Date().toISOString(),
            expiryDate: expiryDate.getTime(),
            expiryAt: admin.firestore.Timestamp.fromDate(expiryDate),
            status: 'active',
            updatedAt: admin.firestore.Timestamp.now()
        };

        await db.collection('subscriptions').doc(userId).set(subscriptionData, { merge: true });
        return subscriptionData;
    }
}

module.exports = new SubscriptionService();
