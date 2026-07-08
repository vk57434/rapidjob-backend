const EmailService = require('../services/EmailService');

/**
 * EmailController - Handles all email-related API requests
 */
class EmailController {
    /**
     * POST /api/email/job-application
     * Sends job application notification to recruiter
     */
    async sendJobApplicationNotification(req, res) {
        console.log('====== EmailController.sendJobApplicationNotification ======');
        console.log('Request Body:', JSON.stringify(req.body, null, 2));

        try {
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
            } = req.body;

            // Validate required fields
            if (!recruiterEmail) {
                console.warn('⚠️ EmailController: recruiterEmail is missing - skipping email');
                return res.status(200).json({
                    success: true,
                    message: 'No recruiter email provided - notification skipped',
                    skipped: true
                });
            }

            if (!jobTitle || !applicantName || !applicantEmail) {
                console.error('❌ EmailController: Missing required fields');
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: jobTitle, applicantName, applicantEmail'
                });
            }

            // Send email
            const result = await EmailService.sendJobApplicationNotification({
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
            });

            if (result.success) {
                console.log('✅ EmailController: Job application notification processed successfully');
                res.status(200).json({
                    success: true,
                    message: 'Notification sent successfully',
                    simulated: result.simulated || false
                });
            } else {
                // Even if email fails, don't return error to client - just log it
                console.error('❌ EmailController: Failed to send notification, but not breaking user flow');
                res.status(200).json({
                    success: true,
                    message: 'Application submitted, but notification failed to send',
                    emailError: result.error
                });
            }

        } catch (error) {
            console.error('====== EmailController.sendJobApplicationNotification ERROR ======');
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);

            // Don't fail the request - email is non-critical
            res.status(200).json({
                success: true,
                message: 'Application submitted, but notification service temporarily unavailable',
                error: error.message
            });
        }
    }

    /**
     * POST /api/email/welcome
     * Sends welcome email to new user (future use)
     */
    async sendWelcomeEmail(req, res) {
        console.log('====== EmailController.sendWelcomeEmail ======');

        try {
            const { email, name, role } = req.body;

            if (!email || !name) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: email and name'
                });
            }

            const result = await EmailService.sendWelcomeEmail({ email, name, role });

            res.status(200).json({
                success: true,
                message: 'Welcome email processed',
                simulated: result.simulated || false
            });

        } catch (error) {
            console.error('====== EmailController.sendWelcomeEmail ERROR ======');
            console.error('Error:', error);

            res.status(200).json({
                success: true,
                message: 'User created, but welcome email failed',
                error: error.message
            });
        }
    }
}

module.exports = new EmailController();
