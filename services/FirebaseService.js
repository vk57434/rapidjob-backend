const { db, rtdb, auth } = require('../config/firebaseAdmin');

class FirebaseService {
    async verifyToken(token) {
        try {
            console.log('📌 FirebaseService.verifyToken: Verifying Firebase ID token...');
            const result = await auth.verifyIdToken(token.replace('Bearer ', ''));
            console.log('✅ FirebaseService.verifyToken: Token verified! UID:', result.uid);
            return result;
        } catch (error) {
            console.error('❌ FirebaseService.verifyToken ERROR:', error.message, '\nStack:', error.stack);
            throw new Error('Invalid Firebase token');
        }
    }

    async getDocument(collection, id) {
        console.log(`📖 FirebaseService.getDocument: Reading ${collection}/${id}`);
        try {
            const doc = await db.collection(collection).doc(id).get();
            if (doc.exists) {
                console.log(`✅ FirebaseService.getDocument: Found ${collection}/${id}`);
                return { id: doc.id, ...doc.data() };
            } else {
                console.log(`⚠️ FirebaseService.getDocument: ${collection}/${id} does NOT exist`);
                return null;
            }
        } catch (error) {
            console.error(`❌ FirebaseService.getDocument ERROR (${collection}/${id}):`, error.message, '\nStack:', error.stack);
            throw error;
        }
    }

    async setDocument(collection, id, data) {
        console.log(`✍️ FirebaseService.setDocument: Writing ${collection}/${id} | Data:`, JSON.stringify(data, null, 2));
        try {
            const result = await db.collection(collection).doc(id).set(data, { merge: true });
            console.log(`✅ FirebaseService.setDocument: Successfully wrote ${collection}/${id}`);
            return result;
        } catch (error) {
            console.error(`❌ FirebaseService.setDocument ERROR (${collection}/${id}):`, error.message, '\nStack:', error.stack);
            throw error;
        }
    }

    async addDocument(collection, data) {
        const dataWithTimestamp = {
            ...data,
            createdAt: new Date().toISOString()
        };
        console.log(`✍️ FirebaseService.addDocument: Adding to ${collection} | Data:`, JSON.stringify(dataWithTimestamp, null, 2));
        try {
            const result = await db.collection(collection).add(dataWithTimestamp);
            console.log(`✅ FirebaseService.addDocument: Successfully added document to ${collection} with ID:`, result.id);
            return result;
        } catch (error) {
            console.error(`❌ FirebaseService.addDocument ERROR (${collection}):`, error.message, '\nStack:', error.stack);
            throw error;
        }
    }

    async updateDocument(collection, id, data) {
        console.log(`✍️ FirebaseService.updateDocument: Updating ${collection}/${id} | Data:`, JSON.stringify(data, null, 2));
        try {
            const result = await db.collection(collection).doc(id).update(data);
            console.log(`✅ FirebaseService.updateDocument: Successfully updated ${collection}/${id}`);
            return result;
        } catch (error) {
            console.error(`❌ FirebaseService.updateDocument ERROR (${collection}/${id}):`, error.message, '\nStack:', error.stack);
            throw error;
        }
    }

    async deleteDocument(collection, id) {
        console.log(`🗑️ FirebaseService.deleteDocument: Deleting ${collection}/${id}`);
        try {
            const result = await db.collection(collection).doc(id).delete();
            console.log(`✅ FirebaseService.deleteDocument: Successfully deleted ${collection}/${id}`);
            return result;
        } catch (error) {
            console.error(`❌ FirebaseService.deleteDocument ERROR (${collection}/${id}):`, error.message, '\nStack:', error.stack);
            throw error;
        }
    }

    async queryCollection(collection, queries = []) {
        console.log(`🔍 FirebaseService.queryCollection: Querying ${collection} | Queries:`, JSON.stringify(queries, null, 2));
        try {
            let ref = db.collection(collection);
            queries.forEach(q => {
                ref = ref.where(q.field, q.operator, q.value);
            });
            const snapshot = await ref.get();
            const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`✅ FirebaseService.queryCollection: Found ${results.length} documents in ${collection}`);
            return results;
        } catch (error) {
            console.error(`❌ FirebaseService.queryCollection ERROR (${collection}):`, error.message, '\nStack:', error.stack);
            throw error;
        }
    }
}

module.exports = new FirebaseService();
