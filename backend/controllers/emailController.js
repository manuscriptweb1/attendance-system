const { sendEmail, verifyEmailConnection } = require('../services/emailService');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

/**
 * Check Email System Health
 * GET /api/email/health
 */
const getEmailHealth = async (req, res) => {
  try {
    const healthResult = await verifyEmailConnection();
    res.json(healthResult);
  } catch (error) {
    console.error('Email health check failed:', error.message);
    res.status(500).json({
      success: false,
      provider: "gmail_smtp",
      smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
      smtpVerified: false,
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      error: error.message || "SMTP connection failed"
    });
  }
};

/**
 * Send Test Email (Super Admin / Emergency Admin only)
 * POST /api/email/test
 */
const sendTestEmail = async (req, res) => {
  try {
    const { toEmail } = req.body;

    if (!toEmail || typeof toEmail !== 'string' || !toEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid toEmail recipient address is required'
      });
    }

    const subject = 'MTM Attendance SMTP Test Email';
    const text = 'This is a test email from MTM Attendance using Google SMTP and Nodemailer.';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">MTM Attendance SMTP Test Email</h2>
        <p>This is a test email from MTM Attendance using <strong>Google SMTP and Nodemailer</strong>.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Dispatched at ${new Date().toLocaleString()}</p>
      </div>
    `;

    const result = await sendEmail({
      toEmail,
      subject,
      text,
      html
    });

    // Log admin activity
    if (req.user) {
      await logAdminActivity({
        adminId: req.user.id,
        adminName: req.user.username || 'Admin',
        adminEmail: req.user.email,
        actionType: ADMIN_ACTION_TYPES.SETTINGS_UPDATE || 'Send Test Email',
        moduleName: MODULE_NAMES.SETTINGS || 'Settings',
        description: `Email test sent to ${toEmail}`,
        ipAddress: getClientIP(req)
      });
    }

    res.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Send test email controller error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send test email'
    });
  }
};

module.exports = {
  getEmailHealth,
  sendTestEmail
};
