const WaApiService = require('../services/WaApiService');
const OtpService = require('../services/OtpService');

/**
 * Send WhatsApp OTP
 * POST /api/auth/send-whatsapp-otp
 */
exports.sendWhatsappOtp = async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    try {
        await OtpService.generateAndSendOtp(phoneNumber);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully via WhatsApp.'
        });
    } catch (error) {
        console.error('Error in sendWhatsappOtp:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP.',
            error: error.message
        });
    }
};

/**
 * Verify WhatsApp OTP
 * POST /api/auth/verify-whatsapp-otp
 */
exports.verifyWhatsappOtp = async (req, res) => {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
        return res.status(400).json({ success: false, message: 'Phone number and OTP are required.' });
    }

    try {
        const customToken = await OtpService.verifyOtp(phoneNumber, otp);
        res.status(200).json({
            success: true,
            message: 'OTP verified successfully.',
            token: customToken
        });
    } catch (error) {
        console.error('Error in verifyWhatsappOtp:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get WAAPI Status
 * GET /api/waapi/status
 */
exports.getWaapiStatus = async (req, res) => {
    try {
        const status = await WaApiService.verifyInstance();
        const health = await WaApiService.healthCheck();

        res.status(200).json({
            success: true,
            instance: status,
            health: health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve WAAPI status.',
            error: error.message
        });
    }
};
