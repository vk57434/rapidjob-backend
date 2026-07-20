const whatsAppService = require('../services/WhatsAppService');
const { auth } = require('../firebase-admin');

class OtpController {
    /**
     * POST /api/otp/send
     */
    async sendOtp(req, res) {
        try {
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number is required."
                });
            }

            // Basic phone format validation (can be enhanced)
            if (!/^\+?[1-9]\d{1,14}$/.test(phoneNumber.replace(/\s/g, ''))) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number format."
                });
            }

            const result = await whatsAppService.generateAndSendOTP(phoneNumber);

            return res.status(200).json({
                success: true,
                message: "OTP sent successfully via WhatsApp.",
                expiresIn: result.expiresIn
            });
        } catch (error) {
            console.error("[OtpController] sendOtp error:", error.message);
            return res.status(error.message.includes('Too many requests') ? 429 : 500).json({
                success: false,
                message: error.message || "Failed to send OTP."
            });
        }
    }

    /**
     * POST /api/otp/verify
     */
    async verifyOtp(req, res) {
        try {
            const { phoneNumber, otp } = req.body;

            if (!phoneNumber || !otp) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number and OTP are required."
                });
            }

            await whatsAppService.verifyOTP(phoneNumber, otp);

            // Generate Firebase Custom Token for the user (using phone number as UID)
            const customToken = await auth.createCustomToken(phoneNumber);

            return res.status(200).json({
                success: true,
                token: customToken,
                message: "OTP verified successfully."
            });
        } catch (error) {
            console.error("[OtpController] verifyOtp error:", error.message);
            return res.status(400).json({
                success: false,
                message: error.message || "OTP verification failed."
            });
        }
    }
}

module.exports = new OtpController();
