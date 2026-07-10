const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!admin.apps.length) {
    try {

        let serviceAccount;

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {

            console.log("Using Firebase credentials from Render Environment");

            serviceAccount = JSON.parse(
                process.env.FIREBASE_SERVICE_ACCOUNT
            );

        } else if (fs.existsSync(serviceAccountPath)) {

            console.log("Using local serviceAccountKey.json");

            serviceAccount = require(serviceAccountPath);

        } else {

            throw new Error("Firebase Admin credentials not found.");

        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL:
                process.env.FIREBASE_DATABASE_URL ||
                "https://rapidjob-f6a1f-default-rtdb.firebaseio.com",
            storageBucket:
                process.env.FIREBASE_STORAGE_BUCKET ||
                "rapidjob-f6a1f.firebasestorage.app"
        });

        console.log("Firebase Admin initialized successfully.");

    } catch (err) {

        console.error(err);

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
