const { auth, db } = require('../config/firebaseAdmin');
const jwt = require('jsonwebtoken');

class AuthController {
    /**
     * POST /api/auth/login
     * Verifies Firebase ID token and issues a custom backend JWT.
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

            // 1. Verify the Firebase ID Token (Source of Truth)
            console.log('Verifying Firebase ID Token...');
            const decodedToken = await auth.verifyIdToken(idToken);
            const uid = decodedToken.uid;
            console.log('Token Verified | UID:', uid);

            // 2. Fetch user profile from Firestore
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

            // 3. Issue a custom Backend JWT signed with the secret provided by the user
            const backendToken = jwt.sign(
                {
                    uid: uid,
                    email: user.email,
                    role: user.role
                },
                process.env.JWT_SECRET || '093e5628ca98688637d44e61efa0c065a9bc71dfb211842b9529ef319cd1de42',
                { expiresIn: '7d' }
            );

            res.json({
                success: true,
                token: backendToken, // App will use this for future Bearer Auth
                user
            });
        } catch (error) {
            console.error('Auth Controller Error:', error);
            res.status(401).json({
                success: false,
                stage: 'Verification/JWT Issue',
                message: error.message
            });
        }
    }

    async register(req, res) {
        res.status(501).json({ message: 'Use Firebase SDK for registration on the app.' });
    }
}

module.exports = new AuthController();
