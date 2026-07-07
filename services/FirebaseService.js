const { db, rtdb, auth } = require('../config/firebaseAdmin');

class FirebaseService {
    async verifyToken(token) {
        try {
            return await auth.verifyIdToken(token.replace('Bearer ', ''));
        } catch (error) {
            throw new Error('Invalid Firebase token');
        }
    }

    async getDocument(collection, id) {
        const doc = await db.collection(collection).doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    }

    async setDocument(collection, id, data) {
        return await db.collection(collection).doc(id).set(data, { merge: true });
    }

    async addDocument(collection, data) {
        return await db.collection(collection).add({
            ...data,
            createdAt: new Date().toISOString()
        });
    }

    async updateDocument(collection, id, data) {
        return await db.collection(collection).doc(id).update(data);
    }

    async deleteDocument(collection, id) {
        return await db.collection(collection).doc(id).delete();
    }

    async queryCollection(collection, queries = []) {
        let ref = db.collection(collection);
        queries.forEach(q => {
            ref = ref.where(q.field, q.operator, q.value);
        });
        const snapshot = await ref.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}

module.exports = new FirebaseService();
