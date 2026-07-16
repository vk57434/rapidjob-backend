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
        console.log(`[OTP] Sending ${otp} to ${phoneNumber} via Console`);
        return true;
    }
}

/**
 * RapidJob Firestore Gateway Provider
 * Adds SMS to Firestore 'smsQueue' for the Android Gateway App to pick up.
 */
class FirestoreOtpProvider extends OtpProvider {
    async sendOtp(phoneNumber, otp) {
        try {
            await db.collection("smsQueue").add({
                phoneNumber,
                message: `Your RapidJob OTP is ${otp}. Valid for 5 minutes.`,
                status: "PENDING",
                createdAt: new Date(),
                retryCount: 0
            });
            console.log(`[OTP] Queued for ${phoneNumber} in smsQueue`);
            return true;
        } catch (error) {
            console.error("[FirestoreOtpProvider] Error queueing SMS:", error);
            throw new Error("Failed to queue SMS for delivery.");
        }
    }
}

module.exports = {
    OtpProvider,
    ConsoleOtpProvider,
    FirestoreOtpProvider
};
