const nodemailer = require('nodemailer');

/**
 * EmailService - Reusable service for sending all types of emails in RapidJob
 * Future-ready for:
 * - Interview Invitation
 * - Candidate Shortlisted
 * - Candidate Rejected
 * - Offer Letter
 * - Subscription Expiry Reminder
 * - Payment Success
 * - Password Reset
 * - Welcome Email
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    /**
     * Initialize Nodemailer transporter using environment variables
     */
    initializeTransporter() {
        try {
            const user = process.env.EMAIL_USER;
            const pass = process.env.EMAIL_PASS;

            if (!user || !pass) {
                console.warn('⚠️ EmailService: EMAIL_USER or EMAIL_PASS not configured - emails will be logged instead');
                this.transporter = null;
                return;
            }

            // Gmail SMTP configuration with high timeouts to prevent Render connection timeouts
            const emailConfig = {
                service: 'gmail',
                auth: {
                    user: user,
                    pass: pass
                },
                connectionTimeout: 30000,
                greetingTimeout: 30000,
                socketTimeout: 30000
            };

            this.transporter = nodemailer.createTransport(emailConfig);

            // Verify connection configuration
            this.transporter.verify((error, success) => {
                if (error) {
                    console.error('❌ SMTP VERIFY FAILED:', error);
                } else {
                    console.log('✅ SMTP READY - Server is ready to take our messages');
                }
            });

        } catch (error) {
            console.error('❌ EmailService initialization failed:', error.message);
            this.transporter = null;
        }
    }

    /**
     * Generate a professional HTML email template
     * @param {Object} options - Email template options
     * @param {string} options.title - Email subject/title
     * @param {string} options.greeting - Greeting text (e.g., "Hello John,")
     * @param {string} options.content - Main email content
     * @param {string} options.buttonText - Button text (optional)
     * @param {string} options.buttonUrl - Button URL (optional)
     * @param {string} options.footer - Footer text (optional)
     * @returns {string} HTML email template
     */
    generateTemplate(options) {
        const {
            title = 'RapidJob Notification',
            greeting = 'Hello,',
            content = '',
            buttonText,
            buttonUrl,
            footer = 'Best regards,<br>The RapidJob Team'
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
                ${footer}
            </p>
        </div>
        <div class="email-footer">
            <p>&copy; ${new Date().getFullYear()} RapidJob. All rights reserved.</p>
            <p style="margin-top: 8px; font-size: 12px;">
                123 Job Street, Tech City, TC 12345
            </p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Send an email
     * @param {Object} emailOptions - Email options
     * @param {string} emailOptions.to - Recipient email
     * @param {string} emailOptions.subject - Email subject
     * @param {string} emailOptions.html - HTML content
     * @param {string} [emailOptions.text] - Plain text content (optional)
     * @returns {Promise<Object>} Send result
     */
    async sendEmail(emailOptions) {
        const { to, subject, html, text } = emailOptions;

        console.log('📧 EmailService: Preparing to send email:', {
            to,
            subject,
            timestamp: new Date().toISOString()
        });

        try {
            // If transporter is not available (no credentials), just log the email
            if (!this.transporter) {
                console.log('📧 EmailService (SIMULATION): Email would be sent');
                console.log('📧 Email Content:', html);
                return {
                    success: true,
                    simulated: true,
                    message: 'Email simulation complete - no email credentials configured'
                };
            }

            const mailOptions = {
                from: `"RapidJob" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html,
                text: text || this.htmlToText(html)
            };

            console.log("Connecting to Gmail SMTP...");
            const info = await this.transporter.sendMail(mailOptions);

            console.log('✅ EMAIL SENT');
            console.log('Message ID:', info.messageId);
            console.log('Info:', info);

            return {
                success: true,
                messageId: info.messageId,
                message: 'Email sent successfully'
            };
        } catch (error) {
            console.error('❌ EMAIL FAILED TO SEND');
            console.error('Error Code:', error.code);
            console.error('Error Command:', error.command);
            console.error('Error Response:', error.response);
            console.error('Error ResponseCode:', error.responseCode);
            console.error('Full Error:', error);

            return {
                success: false,
                error: error.message,
                code: error.code,
                message: 'Failed to send email'
            };
        }
    }

    /**
     * Simple HTML to plain text converter
     */
    htmlToText(html) {
        return html
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Send Job Application Notification to Recruiter
     */
    async sendJobApplicationNotification(data) {
        const {
            recruiterEmail,
            recruiterName,
            jobTitle,
            companyName,
            location,
            salary,
            jobType,
            jobId,
            applicantName,
            applicantEmail,
            phone,
            resumeUrl,
            skills,
            experience,
            appliedAt
        } = data;

        console.log('📧 EmailService: Sending job application notification to recruiter:', recruiterEmail);

        // Format skills as comma-separated string
        const skillsStr = Array.isArray(skills) ? skills.join(', ') : skills || 'Not specified';
        const experienceStr = experience || 'Not specified';

        // Format date
        const appliedDate = new Date(appliedAt || Date.now()).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const content = `
            <p>Great news! You've received a new application for your job posting.</p>
            
            <div class="details-card">
                <h4>📋 Job Details</h4>
                <div class="details-row">
                    <span class="details-label">Job Title:</span>
                    <span class="details-value">${jobTitle}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Company:</span>
                    <span class="details-value">${companyName}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Location:</span>
                    <span class="details-value">${location || 'Not specified'}</span>
                </div>
                ${salary ? `
                <div class="details-row">
                    <span class="details-label">Salary:</span>
                    <span class="details-value">${salary}</span>
                </div>
                ` : ''}
                ${jobType ? `
                <div class="details-row">
                    <span class="details-label">Job Type:</span>
                    <span class="details-value">${jobType}</span>
                </div>
                ` : ''}
            </div>

            <div class="details-card">
                <h4>👤 Applicant Details</h4>
                <div class="details-row">
                    <span class="details-label">Name:</span>
                    <span class="details-value">${applicantName}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Email:</span>
                    <span class="details-value"><a href="mailto:${applicantEmail}">${applicantEmail}</a></span>
                </div>
                <div class="details-row">
                    <span class="details-label">Phone:</span>
                    <span class="details-value">${phone || 'Not provided'}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Experience:</span>
                    <span class="details-value">${experienceStr}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Skills:</span>
                    <span class="details-value">${skillsStr}</span>
                </div>
                ${resumeUrl ? `
                <div class="details-row">
                    <span class="details-label">Resume:</span>
                    <span class="details-value"><a href="${resumeUrl}" target="_blank">View Resume</a></span>
                </div>
                ` : ''}
                <div class="details-row">
                    <span class="details-label">Applied On:</span>
                    <span class="details-value">${appliedDate}</span>
                </div>
            </div>

            <p style="margin-top: 20px;">
                Log in to your RapidJob recruiter dashboard to review the application and take further action.
            </p>
        `;

        const html = this.generateTemplate({
            title: 'New Job Application Received - RapidJob',
            greeting: `Hello ${recruiterName || 'Recruiter'},`,
            content,
            buttonText: 'View Applications',
            buttonUrl: 'https://rapidjob.app/dashboard/applications'
        });

        return await this.sendEmail({
            to: recruiterEmail,
            subject: `New Application: ${applicantName} applied for "${jobTitle}" - RapidJob`,
            html
        });
    }

    /**
     * Send Job Post Notification to Admin
     */
    async sendJobPostAdminNotification(data) {
        const {
            recruiterId,
            recruiterName,
            jobTitle,
            companyName,
            jobId,
            timestamp
        } = data;

        const adminEmail = process.env.ADMIN_EMAIL || 'max459010@gmail.com';
        console.log('📧 EmailService: Sending job post notification to admin:', adminEmail);

        let jobDetails = { jobTitle, companyName, jobId };
        let recruiterDetails = { recruiterId, recruiterName };

        // Fetch additional details from Firestore for a complete report
        try {
            const { db } = require('../firebase-admin');

            // 1. Fetch Job Document
            const jobDoc = await db.collection('jobs').doc(jobId).get();
            if (jobDoc.exists) {
                const jd = jobDoc.data();
                jobDetails = {
                    ...jobDetails,
                    location: jd.location,
                    salary: jd.salary,
                    jobType: jd.jobType,
                    experience: jd.experience,
                    description: jd.description,
                    postedDate: jd.postedTime || jd.postedDate || timestamp
                };
            }

            // 2. Fetch Recruiter Document
            const recruiterDoc = await db.collection('users').doc(recruiterId).get();
            if (recruiterDoc.exists) {
                const rd = recruiterDoc.data();
                recruiterDetails = {
                    ...recruiterDetails,
                    email: rd.email,
                    phone: rd.phone
                };
            }
        } catch (dbError) {
            console.warn('⚠️ EmailService: Database fetch failed, using partial info:', dbError.message);
        }

        const content = `
            <p>A new job has been posted on RapidJob.</p>

            <div class="details-card">
                <h4>📋 Job Details</h4>
                <div class="details-row">
                    <span class="details-label">Job Title:</span>
                    <span class="details-value">${jobDetails.jobTitle}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Company:</span>
                    <span class="details-value">${jobDetails.companyName}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Location:</span>
                    <span class="details-value">${jobDetails.location || 'Not specified'}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Salary:</span>
                    <span class="details-value">${jobDetails.salary || 'Not specified'}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Job Type:</span>
                    <span class="details-value">${jobDetails.jobType || 'Not specified'}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Experience:</span>
                    <span class="details-value">${jobDetails.experience || 'Not specified'}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Job ID:</span>
                    <span class="details-value"><code>${jobId}</code></span>
                </div>
                <div class="details-row">
                    <span class="details-label">Posted On:</span>
                    <span class="details-value">${jobDetails.postedDate || new Date().toLocaleString()}</span>
                </div>
            </div>

            <div class="details-card">
                <h4>👤 Recruiter Details</h4>
                <div class="details-row">
                    <span class="details-label">Name:</span>
                    <span class="details-value">${recruiterDetails.recruiterName}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Email:</span>
                    <span class="details-value">${recruiterDetails.email || 'Not provided'}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Phone:</span>
                    <span class="details-value">${recruiterDetails.phone || 'Not provided'}</span>
                </div>
                <div class="details-row">
                    <span class="details-label">Recruiter ID:</span>
                    <span class="details-value"><code>${recruiterId}</code></span>
                </div>
            </div>

            <div class="details-card">
                <h4>📝 Job Description</h4>
                <div class="content" style="white-space: pre-line; color: #555; font-size: 14px;">
                    ${jobDetails.description || 'No description provided.'}
                </div>
            </div>

            <p style="margin-top: 20px;">
                You can review this job in the Admin Panel.
            </p>
        `;

        const html = this.generateTemplate({
            title: 'New Job Posted - RapidJob',
            greeting: 'Hello Admin,',
            content,
            buttonText: 'Open Admin Panel',
            buttonUrl: 'https://rapidjob.app/admin/jobs'
        });

        return await this.sendEmail({
            to: adminEmail,
            subject: 'New Job Posted - RapidJob',
            html
        });
    }

    /**
     * Send Welcome Email to New User (future use)
     */
    async sendWelcomeEmail(data) {
        const { email, name, role } = data;

        const content = `
            <p>Welcome to RapidJob! 🎉</p>
            <p>We're excited to have you join our platform as a ${role.toLowerCase()}.</p>
            <p>Here's what you can do next:</p>
            <ul style="margin: 15px 0; padding-left: 20px;">
                <li>Complete your profile</li>
                <li>Explore ${role === 'RECRUITER' ? 'posting jobs' : 'job opportunities'}</li>
                <li>Connect with ${role === 'RECRUITER' ? 'talent' : 'employers'}</li>
            </ul>
        `;

        const html = this.generateTemplate({
            title: 'Welcome to RapidJob!',
            greeting: `Hello ${name},`,
            content,
            buttonText: 'Go to Dashboard',
            buttonUrl: 'https://rapidjob.app/dashboard'
        });

        return await this.sendEmail({
            to: email,
            subject: 'Welcome to RapidJob!',
            html
        });
    }
}

module.exports = new EmailService();
