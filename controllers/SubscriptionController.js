const { db } = require('../firebase-admin');

class SubscriptionController {
    async getPlans(req, res) {
        try {
            const snapshot = await db.collection('plans').get();
            const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(plans);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMySubscription(req, res) {
        try {
            const uid = req.user.uid;
            const doc = await db.collection('subscriptions').doc(uid).get();
            if (!doc.exists) return res.status(404).json({ error: 'No subscription found' });
            res.json(doc.data());
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SubscriptionController();
