const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

/**
 * FIREBASE ADMIN INITIALIZATION
 * Read credentials from serviceAccountKey.json
 */

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!admin.apps.length) {
    try {
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL || "https://rapidjob-f6a1f-default-rtdb.firebaseio.com",
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "rapidjob-f6a1f.firebasestorage.app"
            });
            console.log("✅ Firebase Admin: Initialized with serviceAccountKey.json");
        } else {
            console.error("❌ Firebase Admin: serviceAccountKey.json NOT FOUND at", serviceAccountPath);
            // Fallback to environment variables if available
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                console.log("✅ Firebase Admin: Initialized with environment variable");
            } else {
                throw new Error("Missing Firebase Admin credentials!");
            }
        }
    } catch (error) {
        console.error("❌ Firebase Admin: Initialization failed:", error.message);
        process.exit(1);
    }
}

const db = admin.firestore();
const auth = admin.auth();
const rtdb = admin.database();
const storage = admin.storage();

module.exports = {
    admin,
    db,
    auth,
    rtdb,
    storage
};
module.exports.default = admin;
