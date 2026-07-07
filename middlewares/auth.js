const { auth } = require('../config/firebaseAdmin');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Auth Middleware: Token missing or malformed header');
        return res.status(401).json({
            success: false,
            stage: 'Authorization Header',
            message: 'No token provided. Expected format: Bearer <token>'
        });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Auth Middleware: Token verification failed:', error.message);
        return res.status(401).json({
            success: false,
            stage: 'JWT Verification',
            message: 'Invalid or expired token'
        });
    }
};

module.exports = { verifyToken };
