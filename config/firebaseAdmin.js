const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

let serviceAccount;

/**
 * FIREBASE ADMIN INITIALIZATION
 * Support for Local Development (JSON file) and Production (Environment Variable)
 */

console.log("====== Firebase Admin Initialization ======");
// Priority 1: Environment Variable (Production/Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log("✅ Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
        console.log("📊 Service Account Project ID:", serviceAccount.project_id);
    } catch (error) {
        console.error("❌ Firebase Admin: CRITICAL ERROR - Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", error.message);
        process.exit(1);
    }
}
// Priority 2: Local JSON File (Development)
else {
    const localPath = path.join(__dirname, "../firebase-admin.json");
    console.log("🔍 Looking for firebase-admin.json at:", localPath);
    if (fs.existsSync(localPath)) {
        try {
            serviceAccount = require(localPath);
            console.log("✅ Firebase Admin: Using local firebase-admin.json file");
            console.log("📊 Service Account Project ID:", serviceAccount.project_id);
        } catch (error) {
            console.error("❌ Firebase Admin: CRITICAL ERROR - Failed to load local firebase-admin.json:", error.message);
            process.exit(1);
        }
    } else {
        console.error("❌ Firebase Admin: CRITICAL ERROR - No credentials found! Either set FIREBASE_SERVICE_ACCOUNT_JSON environment variable or add firebase-admin.json locally.");
        process.exit(1);
    }
}

// Initialize the app only once
if (!admin.apps.length) {
    try {
        console.log("🔄 Initializing Firebase Admin app...");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || "https://rapidjob-f6a1f-default-rtdb.firebaseio.com",
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "rapidjob-f6a1f.firebasestorage.app"
        });
        console.log("✅ Firebase Admin: Application initialized successfully!");
        console.log("📊 Firebase App Project ID:", admin.app().options.projectId);
    } catch (error) {
        console.error("❌ Firebase Admin: CRITICAL ERROR - Initialization failed:", error.message);
        console.error("Stack trace:", error.stack);
        process.exit(1);
    }
} else {
    console.log("ℹ️ Firebase Admin: App already initialized, reusing existing instance");
}

// Export individual services for easy access
const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();
const storage = admin.storage();

console.log("====== Firebase Admin Initialization Complete ======");

module.exports = {
    admin,
    db,
    rtdb,
    auth,
    storage
};
