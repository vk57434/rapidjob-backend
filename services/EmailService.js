const nodemailer = require('nodemailer');
const { db } = require('../firebase-admin');

/**
 * EmailService - Reusable service for sending all types of emails in RapidJob
 */
class EmailService {

    constructor() {
        this.initializeTransporter();
    }

    initializeTransporter() {
        const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_SECURE } = process.env;

        if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
            console.warn("⚠️ EmailService: Missing required environment variables (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS). Emails will not be sent.");
            this.transporter = null;
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: process.env.EMAIL_SECURE === "true",

            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },

            family: 4,
            connectionTimeout: 120000,
            greetingTimeout: 120000,
            socketTimeout: 120000,
            dnsTimeout: 60000,

            logger: true,
            debug: true
        });

        console.log("✅ EmailService initialized successfully");
        console.log(`📧 SMTP Host: ${EMAIL_HOST}`);
        console.log(`📧 SMTP Port: ${EMAIL_PORT}`);
        console.log(`📧 Secure: ${EMAIL_SECURE}`);
        console.log(`📧 Email User: ${EMAIL_USER}`);
    }

    /**
     * Generate a professional HTML email template
     */
    generateTemplate(options) {
        const {
            title = 'RapidJob Notification',
            greeting = 'Hello,',
            content = '',
            buttonText,
            buttonUrl
        } = options;

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        }
        body {
            background-color: #f5f7fa;
            padding: 20px;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            text-align: center;
        }
        .email-header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 600;
        }
        .email-body {
            padding: 40px 30px;
            color: #333333;
            line-height: 1.6;
        }
        .email-body .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #2c3e50;
        }
        .email-body .content {
            margin-bottom: 30px;
            font-size: 16px;
            color: #555555;
        }
        .email-button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
        }
        .email-footer {
            padding: 25px 30px;
            background-color: #f8f9fa;
            text-align: center;
            color: #888888;
            font-size: 14px;
            border-top: 1px solid #eee;
        }
        .divider {
            height: 1px;
            background-color: #eee;
            margin: 25px 0;
        }
        .details-card {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
        }
        .details-card h4 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .details-row {
            display: flex;
            margin-bottom: 10px;
        }
        .details-label {
            width: 130px;
            font-weight: 600;
            color: #555;
        }
        .details-value {
            color: #333;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🏢 RapidJob</h1>
        </div>
        <div class="email-body">
            <p class="greeting">${greeting}</p>
            <div class="content">
                ${content}
            </div>
            ${buttonText && buttonUrl ? `
                <div style="text-align: center; margin: 25px 0;">
                    <a href="${buttonUrl}" class="email-button">${buttonText}</a>
                </div>
            ` : ''}
            <div class="divider"></div>
            <p style="color: #666; font-size: 15px;">
                Best regards,<br>The RapidJob Team
            </p>
        </div>
        <div class="email-footer">
            <p>&copy; ${new Date().getFullYear()} RapidJob. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Send an email
     */
    async sendEmail(emailOptions) {
        const { to, subject, html, text } = emailOptions;

        console.log('📧 EmailService: Preparing to send email:', { to, subject });

        try {
            if (!this.transporter) {
                console.log('📧 EmailService (SIMULATION): Email would be sent to:', to);
                return { success: true, simulated: true };
            }

            const mailOptions = {
                from: `"RapidJob" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html,
                text: text || this.htmlToText(html)
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ EMAIL SENT:', info.messageId);

            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ EMAIL FAILED:', error.message);
            return { success: false, error: error.message };
        }
    }

    htmlToText(html) {
        return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    async sendJobApplicationNotification(data) {
        const { recruiterEmail, recruiterName, jobTitle, applicantName, applicantEmail } = data;

        const content = `<p>You've received a new application for <b>${jobTitle}</b> from <b>${applicantName}</b> (${applicantEmail}).</p>`;

        const html = this.generateTemplate({
            title: 'New Job Application',
            greeting: `Hello ${recruiterName || 'Recruiter'},`,
            content,
            buttonText: 'View Applications',
            buttonUrl: 'https://rapidjob.app/dashboard/applications'
        });

        return await this.sendEmail({
            to: recruiterEmail,
            subject: `New Application: ${applicantName} for ${jobTitle}`,
            html
        });
    }

    async sendJobPostAdminNotification(data) {
        const { recruiterName, jobTitle, companyName, jobId, jobData = {} } = data;

        const description = jobData.description || 'No description provided.';
        const location = jobData.location || 'Not specified';
        const salary = jobData.salary || 'Not specified';
        const jobType = jobData.jobType || 'Not specified';

        const content = `
            <p>A new job has been posted by <b>${recruiterName}</b> at <b>${companyName}</b>.</p>
            <div class="details-card">
                <h4>📋 Job Details</h4>
                <div class="details-row">
                    <span class="details-label">Title:</span>
                    <span class="details-value">${jobTitle}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Location:</span>
                    <span class="details-value">${location}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Salary:</span>
                    <span class="details-value">${salary}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Type:</span>
                    <span class="details-value">${jobType}</span>
                </div>
                <div class="divider"></div>
                <p><b>Description:</b></p>
                <p style="font-size: 14px; color: #666; margin-top: 5px;">
                    ${description.length > 300 ? description.substring(0, 300) + '...' : description}
                </p>
            </div>
        `;

        const html = this.generateTemplate({
            title: 'New Job Posted',
            greeting: 'Hello Admin,',
            content,
            buttonText: 'Review Job',
            buttonUrl: 'https://rapidjob.app/admin/jobs'
        });

        return await this.sendEmail({
            to: process.env.ADMIN_EMAIL || 'max459010@gmail.com',
            subject: `New Job Posted: ${jobTitle} at ${companyName}`,
            html
        });
    }

    async sendWelcomeEmail(data) {
        const { email, name, role } = data;
        const content = `<p>Welcome to RapidJob! You've joined as a ${role}.</p>`;

        const html = this.generateTemplate({
            title: 'Welcome!',
            greeting: `Hello ${name},`,
            content,
            buttonText: 'Get Started',
            buttonUrl: 'https://rapidjob.app/dashboard'
        });

        return await this.sendEmail({ to: email, subject: 'Welcome to RapidJob!', html });
    }
}

module.exports = new EmailService();
