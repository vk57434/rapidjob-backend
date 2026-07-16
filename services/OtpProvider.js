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

// You can add more providers here later
// class TwilioOtpProvider extends OtpProvider { ... }

module.exports = {
    OtpProvider,
    ConsoleOtpProvider
};
