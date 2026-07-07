const { auth } = require('../config/firebaseAdmin');

const verifyToken = async (req, res, next) => {
    console.log('Verifying Token | Header:', req.headers.authorization ? 'Present' : 'Missing');

    const idToken = req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
        console.error('Auth Middleware Error: No Bearer token provided');
        return res.status(401).json({
            success: false,
            stage: 'Authorization Header',
            message: 'Unauthorized: No token provided'
        });
    }

    try {
        console.log('Auth Middleware: Verifying Firebase ID Token...');
        const decodedToken = await auth.verifyIdToken(idToken);
        console.log('Auth Middleware: Token valid for UID:', decodedToken.uid);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Auth Middleware Error: Invalid token:', error.message);
        return res.status(401).json({
            success: false,
            stage: 'Token Verification',
            message: 'Unauthorized: Invalid token'
        });
    }
};

module.exports = { verifyToken };
