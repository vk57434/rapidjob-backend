const { auth, db } = require('../config/firebaseAdmin');

class AuthController {
    /**
     * POST /api/auth/login
     * Syncs Firebase ID token with local Firestore user profile.
     */
    async login(req, res) {
        console.log('Incoming Login Sync:', req.body);
        try {
            const { idToken } = req.body;

            if (!idToken) {
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'idToken is missing'
                });
            }

            // Verify the Firebase ID Token
            const decodedToken = await auth.verifyIdToken(idToken);
            const uid = decodedToken.uid;
            console.log('Token Verified | UID:', uid);

            // Fetch user profile
            const userDoc = await db.collection('users').doc(uid).get();
            if (!userDoc.exists) {
                console.error('User not found in Firestore | UID:', uid);
                return res.status(404).json({
                    success: false,
                    stage: 'Firestore Lookup',
                    message: 'User profile not found in database. Please register.'
                });
            }

            const user = userDoc.data();
            console.log('Login Successful | Email:', user.email);

            res.json({
                success: true,
                token: idToken, // App will use this for Bearer Auth
                user
            });
        } catch (error) {
            console.error('Auth Controller Error:', error);
            res.status(401).json({
                success: false,
                stage: 'Firebase Verification',
                message: error.message
            });
        }
    }

    async register(req, res) {
        // Implementation for manual registration if needed.
        // Currently, app creates user via Firebase SDK and then calls sync.
        res.status(501).json({ message: 'Use Firebase SDK for registration.' });
    }
}

module.exports = new AuthController();
