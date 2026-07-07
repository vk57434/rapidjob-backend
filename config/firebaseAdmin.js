const admin = require("firebase-admin");
const path = require("path");

// Dynamically load the service account file
const serviceAccountPath = path.join(__dirname, "../firebase-admin.json");
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://rapidjob-f6a1f-default-rtdb.firebaseio.com"
    });
    console.log("Firebase Admin initialized successfully.");
}

const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();
const storage = admin.storage();

module.exports = {
    admin,
    db,
    rtdb,
    auth,
    storage
};
