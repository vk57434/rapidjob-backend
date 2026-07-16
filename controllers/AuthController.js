const otpService = require("../services/OtpService");

class AuthController {
    async sendOtp(req, res) {
        try {
            const { phoneNumber } = req.body;

            if (!phoneNumber || !/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number format."
                });
            }

            await otpService.generateAndSendOtp(phoneNumber);

            res.status(200).json({
                success: true,
                message: "OTP sent successfully."
            });
        } catch (error) {
            console.error("[AuthController] sendOtp error:", error);
            res.status(500).json({
                success: false,
                message: error.message || "Failed to send OTP."
            });
        }
    }

    async verifyOtp(req, res) {
        try {
            const { phoneNumber, otp } = req.body;

            if (!phoneNumber || !otp || otp.length !== 6) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number and 6-digit OTP are required."
                });
            }

            const customToken = await otpService.verifyOtp(phoneNumber, otp);

            res.status(200).json({
                success: true,
                token: customToken,
                message: "OTP verified successfully."
            });
        } catch (error) {
            console.error("[AuthController] verifyOtp error:", error);
            res.status(401).json({
                success: false,
                message: error.message || "OTP verification failed."
            });
        }
    }
}

module.exports = new AuthController();
