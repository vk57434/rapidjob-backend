const axios = require('axios');

/**
 * WhatsAppService - Sends notifications to WhatsApp using a third-party API (UltraMsg/Interakt/etc)
 */
class WhatsAppService {

    constructor() {
        this.token = process.env.WHATSAPP_TOKEN;
        this.instanceId = process.env.WHATSAPP_INSTANCE_ID; // Specific to UltraMsg
        this.adminNumber = process.env.ADMIN_PHONE || "9060915717";
    }

    /**
     * Send message via UltraMsg (Default easy implementation)
     */
    async sendAdminNotification(jobData) {
        if (!this.token || !this.instanceId) {
            console.warn("⚠️ WhatsAppService: Missing WHATSAPP_TOKEN or WHATSAPP_INSTANCE_ID. Notification skipped.");
            return;
        }

        const message = `🚀 *New Job Posted on RapidJob*\n\n` +
            `*Title:* ${jobData.jobTitle}\n` +
            `*Company:* ${jobData.companyName || "N/A"}\n` +
            `*Location:* ${jobData.location || "N/A"}\n` +
            `*Salary:* ${jobData.salary || "N/A"}\n` +
            `*Vacancies:* ${jobData.vacancies || 1}\n\n` +
            `*Recruiter:* ${jobData.recruiterName || "Unknown"}\n` +
            `*Email:* ${jobData.recruiterEmail || "N/A"}\n\n` +
            `_Review this job in the Admin Panel._`;

        try {
            const url = `https://api.ultramsg.com/${this.instanceId}/messages/chat`;

            // Format number: remove +, then ensure it starts with 91
            let formattedNumber = this.adminNumber.replace('+', '');
            if (!formattedNumber.startsWith('91')) {
                formattedNumber = `91${formattedNumber}`;
            }

            const params = {
                token: this.token,
                to: formattedNumber,
                body: message
            };

            const response = await axios.post(url, params);
            console.log('✅ WhatsApp Notification Sent:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ WhatsApp Notification Failed:', error.message);
        }
    }
}

module.exports = new WhatsAppService();
