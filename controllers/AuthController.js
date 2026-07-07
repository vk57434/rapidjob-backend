const { auth, db } = require('../config/firebaseAdmin');

class AuthController {
    async register(req, res) {
        console.log('Incoming register request:', req.body);
        try {
            const { email, password, fullName, role } = req.body;

            if (!email || !password || !fullName) {
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Missing required fields'
                });
            }

            // Create user in Firebase Auth
            console.log('Creating user in Firebase Auth:', email);
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

            console.log('Creating user profile in Firestore for UID:', userRecord.uid);
            await db.collection('users').doc(userRecord.uid).set(userData);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                uid: userRecord.uid
            });
        } catch (error) {
            console.error('Registration Error:', error);
            res.status(400).json({
                success: false,
                stage: 'Firebase Auth/Firestore',
                message: error.message
            });
        }
    }

    async login(req, res) {
        console.log('Incoming login request:', req.body);
        try {
            const { idToken } = req.body;

            if (!idToken) {
                console.error('Login Error: Missing idToken');
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'Firebase ID Token is required'
                });
            }

            // Verify the Firebase ID Token
            console.log('Verifying Firebase ID Token...');
            const decodedToken = await auth.verifyIdToken(idToken);
            const uid = decodedToken.uid;
            console.log('Token verified for UID:', uid);

            // Fetch user profile from Firestore
            console.log('Fetching user profile from Firestore...');
            const userDoc = await db.collection('users').doc(uid).get();

            if (!userDoc.exists) {
                console.error('Login Error: User profile not found for UID:', uid);
                return res.status(404).json({
                    success: false,
                    stage: 'Firestore Lookup',
                    message: 'User profile not found in database'
                });
            }

            const user = userDoc.data();
            console.log('Login successful for:', user.email);

            res.json({
                success: true,
                token: idToken, // We use the Firebase ID Token as the session token
                user
            });
        } catch (error) {
            console.error('Authentication Error:', error);
            res.status(401).json({
                success: false,
                stage: 'JWT/Firebase Verification',
                message: 'Authentication failed: ' + error.message
            });
        }
    }
}

module.exports = new AuthController();
