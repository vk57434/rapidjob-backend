const { auth, db } = require('../config/firebaseAdmin');
const jwt = require('jsonwebtoken');

class AuthController {
    /**
     * POST /api/auth/login
     * Verifies Firebase ID token and issues a custom backend JWT.
     */
    async login(req, res) {
        console.log('====== AuthController.login ======');
        console.log('Incoming Login Sync:', JSON.stringify(req.body, null, 2));
        try {
            const { idToken } = req.body;

            if (!idToken) {
                console.log('Validation Error: idToken is missing');
                return res.status(400).json({
                    success: false,
                    stage: 'Validation',
                    message: 'idToken is missing'
                });
            }

            // 1. Verify the Firebase ID Token (Source of Truth)
            console.log('Step 1: Verifying Firebase ID Token...');
            const decodedToken = await auth.verifyIdToken(idToken);
            const uid = decodedToken.uid;
            const email = decodedToken.email;
            console.log('✅ Token Verified | UID:', uid, '| Email:', email);

            // 2. Fetch or create user profile from Firestore
            console.log('Step 2: Reading user document from Firestore...');
            console.log('📖 Reading users/', uid);
            const userDoc = await db.collection('users').doc(uid).get();
            
            let user;
            if (!userDoc.exists) {
                console.log('⚠️ User not found in Firestore | UID:', uid, '- Creating new user document');
                // Create default user document
                const defaultUser = {
                    uid: uid,
                    email: email,
                    fullName: email?.split('@')[0] || 'User',
                    role: 'JOB_SEEKER',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    profileCompleted: false,
                    memberSince: new Date().getFullYear().toString()
                };
                console.log('✍️ Writing new user document to Firestore:', JSON.stringify(defaultUser, null, 2));
                await db.collection('users').doc(uid).set(defaultUser);
                console.log('✅ New user document created successfully!');
                user = defaultUser;
            } else {
                user = userDoc.data();
                console.log('✅ User document found:', JSON.stringify(user, null, 2));
            }

            console.log('Step 3: Generating backend JWT...');
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
            console.log('✅ Backend JWT generated successfully');

            console.log('====== AuthController.login: SUCCESS ======');
            res.json({
                success: true,
                token: backendToken, // App will use this for future Bearer Auth
                user
            });
        } catch (error) {
            console.error('❌ AuthController.login ERROR:');
            console.error('Error Message:', error.message);
            console.error('Error Stack:', error.stack);
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
