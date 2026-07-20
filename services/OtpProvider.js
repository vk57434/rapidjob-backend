const { db } = require("../firebase-admin");

/**
 * Abstract class for OTP Delivery.
 * Plug in your SMS/WhatsApp gateway here.
 */
class OtpProvider {
    async sendOtp(phoneNumber, otp) {
        throw new Error("sendOtp() must be implemented");
    }
}

class ConsoleOtpProvider extends OtpProvider {
    async sendOtp(phoneNumber, otp) {
        console.log(`[OTP-DEBUG] Sending ${otp} to ${phoneNumber} via Console`);
        return true;
    }
}

/**
 * RapidJob Firestore Gateway Provider
 * Communicates with the Android SMS Gateway via Firestore.
 * This is the production provider that avoids log scraping.
 */
class FirestoreOtpProvider extends OtpProvider {
    async sendOtp(phoneNumber, otp) {
        try {
            // Requirement 4 & 7: Use Firestore as the primary communication channel
            await db.collection("smsQueue").add({
                phoneNumber,
                message: `Your RapidJob OTP is ${otp}. Valid for 5 minutes.`,
                status: "PENDING",
                createdAt: new Date(),
                retryCount: 0
            });

            // Log for server status, but logic doesn't depend on it
            console.log(`[AUTH] OTP for ${phoneNumber} added to Firestore smsQueue`);
            return true;
        } catch (error) {
            console.error("[FirestoreOtpProvider] Error queueing SMS:", error);
            throw new Error("Failed to queue SMS for delivery.");
        }
    }
}

/**
 * WAAPI Provider
 * Sends OTP via WhatsApp using WaApiService.
 */
class WaapiOtpProvider extends OtpProvider {
    constructor() {
        super();
        this.waapiService = require('./WaApiService');
    }

    async sendOtp(phoneNumber, otp) {
        try {
            await this.waapiService.sendOTP(phoneNumber, otp);
            console.log(`[AUTH] OTP for ${phoneNumber} sent via WhatsApp (WAAPI)`);
            return true;
        } catch (error) {
            console.error("[WaapiOtpProvider] Error sending WhatsApp message:", error);
            throw new Error("Failed to send WhatsApp message.");
        }
    }
}

module.exports = {
    OtpProvider,
    ConsoleOtpProvider,
    FirestoreOtpProvider,
    WaapiOtpProvider
};
