const jwt = require('jsonwebtoken');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    console.log('Auth Middleware: Incoming request with authorization header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Auth Middleware: Token missing or malformed header');
        return res.status(401).json({
            success: false,
            stage: 'Authorization Header',
            message: 'No token provided. Expected format: Bearer <token>'
        });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('Auth Middleware: Token extracted, length:', token.length);

    try {
        const jwtSecret = process.env.JWT_SECRET || '8349bf2d1e90b21a97a8fd088eb8ec823300fc373ba9d4ca21dae945ce2e28c8';
        
        const decodedToken = jwt.verify(token, jwtSecret);
        console.log('Auth Middleware: Token verified successfully for UID:', decodedToken.uid);
        
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Auth Middleware: Token verification failed:', error.message);
        console.error('Auth Middleware: Error name:', error.name);
        
        let errorMessage = 'Invalid or expired token';
        if (error.name === 'TokenExpiredError') {
            errorMessage = 'Token has expired';
        } else if (error.name === 'JsonWebTokenError') {
            errorMessage = 'Invalid token format';
        }
        
        return res.status(401).json({
            success: false,
            stage: 'JWT Verification',
            message: errorMessage
        });
    }
};

module.exports = { verifyToken };
