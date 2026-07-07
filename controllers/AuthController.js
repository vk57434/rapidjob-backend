const { auth, db } = require('../config/firebaseAdmin');
const jwt = require('jsonwebtoken');

class AuthController {
    async register(req, res) {
        try {
            const { email, password, fullName, role } = req.body;

            // Create user in Firebase Auth
            const userRecord = await auth.createUser({
                email,
                password,
                displayName: fullName
            });

            // Create user profile in Firestore
            const userData = {
                uid: userRecord.uid,
                email,
                fullName,
                role: role || 'candidate',
                createdAt: new Date().toISOString(),
                isVerified: false
            };

            await db.collection('users').doc(userRecord.uid).set(userData);

            res.status(201).json({
                message: 'User registered successfully',
                uid: userRecord.uid
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { idToken } = req.body;

            // Verify the Firebase ID Token
            const decodedToken = await auth.verifyIdToken(idToken);
            const uid = decodedToken.uid;

            // Fetch user profile from Firestore
            const userDoc = await db.collection('users').doc(uid).get();
            if (!userDoc.exists) {
                return res.status(404).json({ error: 'User profile not found' });
            }

            const user = userDoc.data();

            // Create a custom JWT if needed, or just return user info
            const token = jwt.sign(
                { uid, email: user.email, role: user.role },
                process.env.JWT_SECRET || 'rapidjob_secret',
                { expiresIn: '7d' }
            );

            res.json({
                token,
                user
            });
        } catch (error) {
            res.status(401).json({ error: 'Authentication failed' });
        }
    }
}

module.exports = new AuthController();
