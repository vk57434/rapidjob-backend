const bcrypt = require("bcrypt");
const crypto = require("crypto");
const otpRepository = require("../repositories/OtpRepository");
const { ConsoleOtpProvider, FirestoreOtpProvider } = require("./OtpProvider");
const { auth } = require("../firebase-admin");

class OtpService {
    /**
     * Requirement 8 & 9: Choose the provider based on the environment.
     * Use FirestoreOtpProvider for production SMS delivery via Android Gateway.
     * Keep ConsoleOtpProvider for local development.
     */
    constructor() {
        // Use Node Environment to swap providers automatically
        this.provider = process.env.NODE_ENV === "production"
            ? new FirestoreOtpProvider()
            : new ConsoleOtpProvider();

        this.EXPIRY_MINUTES = 5;
        this.MAX_ATTEMPTS = 5;
        this.MAX_REQUESTS_IN_10_MINS = 3;
    }

    async generateAndSendOtp(phoneNumber) {
        // Requirement 10: Rate limiting check (3 requests every 10 mins)
        const existingOtp = await otpRepository.getOtp(phoneNumber);
        if (existingOtp) {
            const now = new Date();
            const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

            // Handle Firestore Timestamp object to get Date
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

        // Requirement 1: Generate secure 6-digit OTP in Node.js
        const otp = crypto.randomInt(100000, 999999).toString();

        // Requirement 2: Hash OTP using bcrypt for security (Replay Attack Protection)
        const saltRounds = 10;
        const otpHash = await bcrypt.hash(otp, saltRounds);

        // Requirement 3: Store OTP Hash and metadata in Firestore
        const expiresAt = new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000);
        await otpRepository.saveOtp(phoneNumber, otpHash, expiresAt);

        // Requirement 4 & 6: Send via configured provider (Console or Firestore Queue)
        return await this.provider.sendOtp(phoneNumber, otp);
    }

    /**
     * Requirement 10 & 11: Verify OTP using Firestore and bcrypt.
     */
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

        // Check attempts limit (5 attempts)
        if (otpData.attempts >= this.MAX_ATTEMPTS) {
            await otpRepository.deleteOtp(phoneNumber);
            throw new Error("Maximum verification attempts exceeded. Please request a new OTP.");
        }

        // Requirement 10: Verify hash using bcrypt
        const isValid = await bcrypt.compare(otp, otpData.otpHash);
        if (!isValid) {
            await otpRepository.incrementAttempts(phoneNumber);
            throw new Error(`Invalid OTP. ${this.MAX_ATTEMPTS - (otpData.attempts + 1)} attempts remaining.`);
        }

        // Requirement 11: Success - Delete OTP document and create Firebase Custom Token
        await otpRepository.deleteOtp(phoneNumber);

        // Generate Custom Token for user login using phone number as UID
        const customToken = await auth.createCustomToken(phoneNumber);
        return customToken;
    }
}

module.exports = new OtpService();
