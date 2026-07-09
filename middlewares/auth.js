const { auth, db } = require('../config/firebaseAdmin');

/**
 * Middleware to verify Firebase ID Token using Firebase Admin SDK.
 * Replaces legacy JWT verification.
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    console.log('[BACKEND AUTH] Incoming Request Header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[BACKEND AUTH] Missing or malformed Authorization header');
        return res.status(401).json({
            success: false,
            stage: 'Authorization Header',
            message: 'No token provided. Expected format: Bearer <token>'
        });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Safety check for common mistakes
    if (!idToken || idToken === 'null' || idToken === 'undefined' || idToken === '') {
        console.error('[BACKEND AUTH] Invalid token value received:', idToken);
        return res.status(401).json({
            success: false,
            stage: 'Token Extraction',
            message: 'Invalid token value received'
        });
    }

    try {
        console.log('[BACKEND AUTH] Firebase Token Verification started...');
        const decodedToken = await auth.verifyIdToken(idToken);

        // Fetch user from Firestore to get their latest role
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists) {
            console.error('[BACKEND AUTH] User record missing in Firestore for UID:', decodedToken.uid);
            return res.status(403).json({
                success: false,
                message: 'User record not found. Access denied.'
            });
        }

        const userData = userDoc.data();
        console.log('[BACKEND AUTH] Decoded UID:', decodedToken.uid, '| Role:', userData.role);

        // Attach user info to request object
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: userData.fullName || decodedToken.name || decodedToken.email?.split('@')[0],
            role: userData.role || 'JOB_SEEKER',
            auth_provider: decodedToken.firebase.sign_in_provider
        };

        next();
    } catch (error) {
        console.error('[BACKEND AUTH] Firebase Verification Failure:', error.message);

        let errorMessage = 'Authentication failed';
        if (error.code === 'auth/id-token-expired') {
            errorMessage = 'Firebase ID Token has expired';
        } else if (error.code === 'auth/argument-error') {
            errorMessage = 'Invalid Firebase ID Token format';
        }

        return res.status(401).json({
            success: false,
            stage: 'Firebase ID Token Verification',
            message: errorMessage,
            error_code: error.code
        });
    }
};

/**
 * Middleware to restrict access to ADMIN only.
 * Must be used after verifyToken.
 */
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        console.log('[BACKEND AUTH] Admin access granted for UID:', req.user.uid);
        next();
    } else {
        console.warn('[BACKEND AUTH] Unauthorized admin access attempt by UID:', req.user?.uid, '| Role:', req.user?.role);
        res.status(403).json({
            success: false,
            message: 'Admin access required. You do not have permission to perform this action.'
        });
    }
};

module.exports = { verifyToken, isAdmin };
