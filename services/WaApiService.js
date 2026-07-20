const axios = require('axios');
const crypto = require('crypto');
const { db } = require('../firebase-admin');

class WaApiService {
    constructor() {
        this.baseUrl = process.env.WAAPI_BASE_URL || 'https://waapi.app/api/v1';
        this.apiToken = process.env.WAAPI_API_TOKEN;
        this.instanceId = process.env.WAAPI_INSTANCE_ID;

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 20000
        });

        // Logging interceptors
        this.client.interceptors.request.use(request => {
            console.log(`[WAAPI] Request: ${request.method.toUpperCase()} ${request.baseURL}${request.url}`);
            // console.log('[WAAPI] Request Data:', request.data);
            return request;
        });

        this.client.interceptors.response.use(
            response => {
                console.log(`[WAAPI] Response Status: ${response.status}`);
                return response;
            },
            error => {
                console.error(`[WAAPI] Error: ${error.response?.status || 'Network Error'} - ${JSON.stringify(error.response?.data || error.message)}`);
                return Promise.reject(error);
            }
        );

        this.otpCollection = db.collection('whatsapp_otps');
    }

    /**
     * Verifies the WAAPI instance status and connection
     */
    async verifyInstance() {
        if (!this.apiToken || !this.instanceId) {
            return {
                success: false,
                message: "Missing WAAPI_API_TOKEN or WAAPI_INSTANCE_ID in environment variables."
            };
        }

        try {
            const response = await this.client.get(`/instances/${this.instanceId}`);
            const data = response.data.data;

            return {
                success: true,
                instanceId: data.id,
                status: data.status,
                owner: data.owner,
                webhookUrl: data.webhook_url,
                qrStatus: data.qr_code ? 'Required' : 'Connected/Not Required'
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || error.message,
                status: error.response?.status
            };
        }
    }

    /**
     * Health check for internal monitoring
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            const response = await this.client.get('/me');
            const duration = Date.now() - startTime;

            return {
                status: 'healthy',
                responseTime: `${duration}ms`,
                waapiStatus: response.status === 200 ? 'online' : 'unreachable'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Send a general message
     */
    async sendMessage(chatId, text) {
        try {
            const response = await this.client.post(`/instances/${this.instanceId}/client/action/send-message`, {
                chatId: chatId,
                message: text
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Generate and send OTP
     */
    async sendOTP(phoneNumber, otp) {
        // Convert phone number to chatId: 91XXXXXXXXXX@c.us
        let cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;
        const chatId = `${cleanNumber}@c.us`;

        const message = `Your RapidJob OTP is ${otp}. Valid for 5 minutes.`;

        try {
            return await this.sendMessage(chatId, message);
        } catch (error) {
            console.error(`[WaApiService] Failed to send OTP to ${phoneNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Helper to generate a secure 6-digit OTP
     */
    generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Store OTP in Firestore with expiry
     */
    async storeOTP(phoneNumber, otp) {
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await this.otpCollection.doc(phoneNumber).set({
            otp,
            phone: phoneNumber,
            expiresAt,
            verified: false,
            createdAt: new Date()
        });
    }

    /**
     * Verify OTP from Firestore
     */
    async verifyOTP(phoneNumber, otp) {
        const otpDoc = await this.otpCollection.doc(phoneNumber).get();

        if (!otpDoc.exists) {
            throw new Error('No OTP found for this number.');
        }

        const data = otpDoc.data();

        if (data.verified) {
            throw new Error('OTP already verified.');
        }

        if (new Date() > data.expiresAt.toDate()) {
            await this.otpCollection.doc(phoneNumber).delete();
            throw new Error('OTP has expired.');
        }

        if (data.otp !== otp) {
            throw new Error('Invalid OTP.');
        }

        // Mark as verified and then delete
        await this.otpCollection.doc(phoneNumber).update({
            verified: true
        });

        // Deleting after verification as requested
        await this.otpCollection.doc(phoneNumber).delete();

        return true;
    }
}

module.exports = new WaApiService();
