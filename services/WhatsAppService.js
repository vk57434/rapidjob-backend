const axios = require('axios');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { db } = require('../firebase-admin');

/**
 * WhatsAppService - Integrated WaAPI Service for notifications and OTP verification
 */
class WhatsAppService {
    constructor() {
        this.baseUrl = process.env.WAAPI_BASE_URL || 'https://waapi.app/api/v1';
        this.apiToken = process.env.WAAPI_API_TOKEN;
        this.instanceId = process.env.WAAPI_INSTANCE_ID;

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 seconds timeout
        });

        this.otpCollection = db.collection('otps');
        this.EXPIRY_MINS = 5;
        this.RATE_LIMIT_MINS = 10;
        this.MAX_REQUESTS = 3;
    }

    /**
     * Send a plain text message via WaAPI
     */
    async sendText(phoneNumber, message) {
        if (!this.apiToken || !this.instanceId) {
            console.warn("⚠️ WhatsAppService: Missing WAAPI_API_TOKEN or WAAPI_INSTANCE_ID.");
            throw new Error("WhatsApp Service configuration missing.");
        }

        try {
            // Clean number and format for WaAPI (@c.us for individual numbers)
            let cleanNumber = phoneNumber.replace(/\D/g, '');
            // Ensure it has country code, default to 91 if not present and length is 10
            if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;

            const chatId = `${cleanNumber}@c.us`;

            const response = await this.client.post(`/instances/${this.instanceId}/client/action/send-message`, {
                chatId: chatId,
                message: message
            });

            console.log(`✅ [WhatsAppService] Message sent to ${phoneNumber}. WaAPI ID:`, response.data.data?.id || 'N/A');
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`❌ [WhatsAppService] Failed to send message to ${phoneNumber}:`, errorMsg);
            throw new Error(`WaAPI Error: ${errorMsg}`);
        }
    }

    /**
     * Send OTP message with standard format
     */
    async sendOTP(phoneNumber, otp) {
        const message = `RapidJob Verification\n\nYour OTP is: ${otp}\n\nThis OTP is valid for 5 minutes.\n\nDo not share this code with anyone.\n\n— RapidJob`;
        return await this.sendText(phoneNumber, message);
    }

    /**
     * Generate, store, and send a 6-digit OTP
     */
    async generateAndSendOTP(phoneNumber) {
        const now = new Date();
        const tenMinsAgo = new Date(now.getTime() - this.RATE_LIMIT_MINS * 60 * 1000);

        // 1. Rate Limiting Check
        const otpDoc = await this.otpCollection.doc(phoneNumber).get();
        let requestCount = 1;

        if (otpDoc.exists) {
            const data = otpDoc.data();
            const lastRequestAt = data.lastRequestAt?.toDate() || new Date(0);

            if (lastRequestAt > tenMinsAgo) {
                if (data.requestCount >= this.MAX_REQUESTS) {
                    console.warn(`⚠️ [WhatsAppService] Rate limit hit for ${phoneNumber}`);
                    throw new Error(`Too many requests. Please try again after ${this.RATE_LIMIT_MINS} minutes.`);
                }
                requestCount = data.requestCount + 1;
            }
        }

        // 2. Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(now.getTime() + this.EXPIRY_MINS * 60 * 1000);

        // 3. Store in Firestore
        await this.otpCollection.doc(phoneNumber).set({
            phoneNumber,
            otpHash,
            createdAt: now,
            expiresAt,
            verified: false,
            requestCount,
            lastRequestAt: now
        });

        console.log(`🔢 [WhatsAppService] OTP generated for ${phoneNumber}`);

        // 4. Send via WaAPI
        await this.sendOTP(phoneNumber, otp);

        return {
            success: true,
            expiresIn: this.EXPIRY_MINS * 60
        };
    }

    /**
     * Verify the provided OTP
     */
    async verifyOTP(phoneNumber, otp) {
        const otpDoc = await this.otpCollection.doc(phoneNumber).get();

        if (!otpDoc.exists) {
            console.warn(`❌ [WhatsAppService] Verification failed: No OTP found for ${phoneNumber}`);
            throw new Error('OTP not found. Please request a new one.');
        }

        const data = otpDoc.data();

        if (data.verified) {
            throw new Error('OTP already verified and used.');
        }

        if (new Date() > data.expiresAt.toDate()) {
            console.warn(`❌ [WhatsAppService] Verification failed: OTP expired for ${phoneNumber}`);
            throw new Error('OTP has expired.');
        }

        const isValid = await bcrypt.compare(otp, data.otpHash);
        if (!isValid) {
            console.warn(`❌ [WhatsAppService] Verification failed: Invalid OTP for ${phoneNumber}`);
            throw new Error('Invalid OTP.');
        }

        // Mark as verified but don't delete yet if we need to block account creation until verified
        // Usually, we'd return a token here or allow the next step.
        await this.otpCollection.doc(phoneNumber).update({
            verified: true,
            verifiedAt: new Date()
        });

        console.log(`✅ [WhatsAppService] OTP verified successfully for ${phoneNumber}`);
        return true;
    }
}

module.exports = new WhatsAppService();
