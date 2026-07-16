const { db } = require("../firebase-admin");

class OtpRepository {
    constructor() {
        this.collection = db.collection("otps");
    }

    async saveOtp(phoneNumber, otpHash, expiresAt) {
        await this.collection.doc(phoneNumber).set({
            phoneNumber,
            otpHash,
            expiresAt,
            attempts: 0,
            createdAt: new Date(),
            requestCount: 1,
            lastRequestAt: new Date()
        });
    }

    async getOtp(phoneNumber) {
        const doc = await this.collection.doc(phoneNumber).get();
        return doc.exists ? doc.data() : null;
    }

    async incrementAttempts(phoneNumber) {
        const docRef = this.collection.doc(phoneNumber);
        const doc = await docRef.get();
        if (doc.exists) {
            await docRef.update({
                attempts: (doc.data().attempts || 0) + 1
            });
        }
    }

    async updateRequestStats(phoneNumber) {
        const docRef = this.collection.doc(phoneNumber);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            const now = new Date();
            const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

            let count = data.requestCount || 0;
            if (data.lastRequestAt && data.lastRequestAt.toDate() < tenMinutesAgo) {
                count = 1;
            } else {
                count += 1;
            }

            await docRef.update({
                requestCount: count,
                lastRequestAt: now
            });
            return count;
        }
        return 1;
    }

    async deleteOtp(phoneNumber) {
        await this.collection.doc(phoneNumber).delete();
    }
}

module.exports = new OtpRepository();
