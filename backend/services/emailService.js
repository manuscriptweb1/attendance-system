const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error("SMTP configuration is missing");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const isSecure = process.env.SMTP_SECURE === "true" || port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: port,
    secure: isSecure,
    requireTLS: !isSecure,
    family: 4, // Force IPv4 resolution to prevent ENETUNREACH IPv6 routing errors on cloud instances (Render/Railway/AWS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 25000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    dnsTimeout: 10000
  });

  return transporter;
}

async function verifyEmailConnection() {
  try {
    const mailTransporter = getTransporter();
    await mailTransporter.verify();

    return {
      success: true,
      provider: "gmail_smtp",
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      smtpConfigured: true,
      smtpVerified: true,
    };
  } catch (error) {
    let safeMessage = error.message;
    if (safeMessage && (safeMessage.includes("Invalid login") || safeMessage.includes("Username and Password not accepted"))) {
      safeMessage = "Gmail SMTP authentication failed. Check SMTP_USER and Google App Password. Make sure 2-Step Verification is enabled.";
    }
    throw new Error(safeMessage || "SMTP connection failed");
  }
}

async function sendEmail({
  toEmail,
  toName,
  subject,
  html,
  text,
  attachments = [],
}) {
  if (!toEmail) {
    throw new Error("Recipient email is missing");
  }

  // Check feature flags
  if (process.env.OTP_EMAIL_ENABLED === 'false' && subject?.includes('OTP')) {
    throw new Error('OTP email sending is disabled in system configuration');
  }
  if (process.env.PAYSLIP_EMAIL_ENABLED === 'false' && subject?.includes('Payslip')) {
    throw new Error('Payslip email sending is disabled in system configuration');
  }

  const mailTransporter = getTransporter();
  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || "MTM Attendance"}" <${process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER}>`,
    to: toName ? `"${toName}" <${toEmail}>` : toEmail,
    replyTo: process.env.MAIL_REPLY_TO || process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER,
    subject,
    html,
    text,
    attachments,
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    return {
      messageId: info.messageId,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
      response: info.response,
    };
  } catch (err) {
    const isNetworkOrTimeoutErr = err.message && (
      err.message.toLowerCase().includes('timeout') ||
      err.message.includes('ECONNRESET') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('ESOCKET') ||
      err.message.includes('ENETUNREACH') ||
      err.message.includes('EHOSTUNREACH') ||
      err.message.includes('ENOTFOUND') ||
      err.message.includes('ECONNREFUSED') ||
      err.code === 'ENETUNREACH' ||
      err.code === 'EHOSTUNREACH' ||
      err.code === 'ETIMEDOUT'
    );

    if (isNetworkOrTimeoutErr) {
      console.warn(`⚠️ SMTP send encountered network error (${err.message}). Retrying with fresh IPv4 connection...`);
      try {
        transporter = null; // Reset cached transporter to force fresh lookup
        const freshTransporter = getTransporter();
        const retryInfo = await freshTransporter.sendMail(mailOptions);
        return {
          messageId: retryInfo.messageId,
          accepted: retryInfo.accepted || [],
          rejected: retryInfo.rejected || [],
          response: retryInfo.response,
        };
      } catch (retryErr) {
        console.error('❌ SMTP Retry also failed:', retryErr.message);
        throw retryErr;
      }
    }
    throw err;
  }
}

/**
 * Send OTP Email via Google SMTP Nodemailer
 */
async function sendOTPEmail(email, employeeName, otp, expiryMinutes = 10, purpose = 'password_reset') {
  try {
    const name = employeeName || 'Employee';
    const subject = 'Your MTM Attendance OTP Code';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none; }
    .otp-box { background-color: #f1f5f9; border: 2px dashed #3b82f6; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px; }
    .otp-code { font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 6px; font-family: 'Courier New', monospace; }
    .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">MTM Attendance System</h2>
    </div>
    <div class="content">
      <p>Dear <strong>${name}</strong>,</p>
      <p>Your OTP code is <strong>${otp}</strong>.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px;">Valid for ${expiryMinutes} minutes</p>
      </div>
      <p>This code is valid for ${expiryMinutes} minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
      <br/>
      <p>Regards,<br/><strong>MTM Attendance</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
  `;

    const text = `Dear ${name},\nYour OTP code is ${otp}.\nThis code is valid for ${expiryMinutes} minutes.\nIf you did not request this, please ignore this email.`;

    const result = await sendEmail({
      toEmail: email,
      toName: name,
      subject,
      html,
      text,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('❌ OTP email sending error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function testEmailConfig() {
  try {
    const res = await verifyEmailConnection();
    return { success: true, message: 'Google SMTP connection verified successfully', provider: res.provider };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
  verifyEmailConnection,
  sendOTPEmail,
  testEmailConfig
};
