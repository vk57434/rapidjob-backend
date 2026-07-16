const bcrypt = require("bcrypt");
const crypto = require("crypto");
const otpRepository = require("../repositories/OtpRepository");
const { ConsoleOtpProvider, FirestoreOtpProvider } = require("./OtpProvider");
const { auth } = require("../firebase-admin");

class OtpService {
    /**
     * Choose the provider based on the environment or preference.
     * Use FirestoreOtpProvider for production SMS delivery via Android Gateway.
     */
    constructor() {
        this.provider = process.env.NODE_ENV === "production"
            ? new FirestoreOtpProvider()
            : new ConsoleOtpProvider();

        this.EXPIRY_MINUTES = 5;
        this.MAX_ATTEMPTS = 5;
        this.MAX_REQUESTS_IN_10_MINS = 3;
    }

    async generateAndSendOtp(phoneNumber) {
        // 1. Rate limiting check (3 requests every 10 mins)
        const existingOtp = await otpRepository.getOtp(phoneNumber);
        if (existingOtp) {
            const now = new Date();
            const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

            // Access toDate() because of Firestore Timestamp object
            const lastRequestDate = existingOtp.lastRequestAt?.toDate
                ? existingOtp.lastRequestAt.toDate()
                : new Date(existingOtp.lastRequestAt);

            if (lastRequestDate > tenMinutesAgo) {
                if (existingOtp.requestCount >= this.MAX_REQUESTS_IN_10_MINS) {
                    throw new Error("Too many OTP requests. Please try again after 10 minutes.");
                }
                await otpRepository.updateRequestStats(phoneNumber);
            }
        }

        // 2. Generate secure 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();

        // 3. Hash OTP
        const saltRounds = 10;
        const otpHash = await bcrypt.hash(otp, saltRounds);

        // 4. Calculate expiry
        const expiresAt = new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000);

        // 5. Store OTP
        await otpRepository.saveOtp(phoneNumber, otpHash, expiresAt);

        // 6. Send via provider (Console or Firestore Queue)
        return await this.provider.sendOtp(phoneNumber, otp);
    }

    async verifyOtp(phoneNumber, otp) {
        const otpData = await otpRepository.getOtp(phoneNumber);

        if (!otpData) {
            throw new Error("OTP not found. Please request a new one.");
        }

        // Handle Firestore Timestamp
        const expiresAt = otpData.expiresAt?.toDate
            ? otpData.expiresAt.toDate()
            : new Date(otpData.expiresAt);

        // Check expiry
        if (new Date() > expiresAt) {
            await otpRepository.deleteOtp(phoneNumber);
            throw new Error("OTP has expired.");
        }

        // Check attempts
        if (otpData.attempts >= this.MAX_ATTEMPTS) {
            await otpDocRef.delete(); // Delete and throw error
            throw new Error("Maximum verification attempts exceeded. Please request a new OTP.");
        }

        // Verify hash
        const isValid = await bcrypt.compare(otp, otpData.otpHash);
        if (!isValid) {
            await otpRepository.incrementAttempts(phoneNumber);
            throw new Error(`Invalid OTP. ${this.MAX_ATTEMPTS - (otpData.attempts + 1)} attempts remaining.`);
        }

        // Success - Delete OTP and create Firebase Custom Token
        await otpRepository.deleteOtp(phoneNumber);

        // Create Firebase Custom Token for the login
        const customToken = await auth.createCustomToken(phoneNumber);
        return customToken;
    }
}

module.exports = new OtpService();
