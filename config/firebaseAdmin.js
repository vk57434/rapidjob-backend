const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

let serviceAccount;

/**
 * Priority:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON (Environment Variable for Render/Production)
 * 2. firebase-admin.json (Local file for development)
 */
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log("Firebase Admin: Initializing using environment variable.");
    } else {
        const serviceAccountPath = path.join(__dirname, "../firebase-admin.json");
        if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
            console.log("Firebase Admin: Initializing using local JSON file.");
        } else {
            console.warn("Firebase Admin: No credentials found. Set FIREBASE_SERVICE_ACCOUNT_JSON or add firebase-admin.json.");
        }
    }
} catch (error) {
    console.error("Firebase Admin: Failed to parse credentials:", error.message);
}

if (!admin.apps.length && serviceAccount) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || "https://rapidjob-f6a1f-default-rtdb.firebaseio.com",
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "rapidjob-f6a1f.firebasestorage.app"
        });
        console.log("Firebase Admin: Application initialized successfully.");
    } catch (error) {
        console.error("Firebase Admin: Initialization error:", error.message);
    }
}

const db = admin.apps.length ? admin.firestore() : null;
const rtdb = admin.apps.length ? admin.database() : null;
const auth = admin.apps.length ? admin.auth() : null;
const storage = admin.apps.length ? admin.storage() : null;

module.exports = {
    admin,
    db,
    rtdb,
    auth,
    storage
};
