const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

const sendOTPEmail = async (email, employeeName, otp, expiryMinutes, purpose = 'password_reset') => {
  try {
    const purposeText = purpose === 'password_change' ? 'change your password' : 'reset your password';
    const actionText = purpose === 'password_change' ? 'password change' : 'password reset';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background-color: white; padding: 30px; border-radius: 0 0 10px 10px; }
    .otp-box { background-color: #f0f4ff; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px; }
    .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: 'Courier New', monospace; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${employeeName}</strong>,</p>
      <p>We received a request to ${purposeText} for your Attendance Management System account.</p>
      <p>Your One-Time Password (OTP) is:</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Valid for ${expiryMinutes} minutes</p>
      </div>
      <p><strong>Please use this OTP to complete your ${actionText} process.</strong></p>
      <div class="warning">
        <strong>Security Notice:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>This OTP is valid for ${expiryMinutes} minutes only</li>
          <li>Never share this OTP with anyone</li>
          <li>Our team will never ask for your OTP</li>
          <li>If you did not request this, please ignore this email</li>
        </ul>
      </div>
      <p style="margin-top: 25px;">If you did not request this action, please ignore this email and ensure your account is secure.</p>
      <p style="margin-top: 25px;"><strong>Regards,</strong><br>Attendance Management Team</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
      <p>&copy; ${new Date().getFullYear()} Attendance Management System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Use Brevo (Sendinblue) API
    if (process.env.BREVO_API_KEY) {
      console.log('Using Brevo API for email sending...');
      console.log('API Key exists:', process.env.BREVO_API_KEY ? 'Yes' : 'No');
      console.log('API Key length:', process.env.BREVO_API_KEY?.length);
      
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: process.env.EMAIL_FROM_NAME || 'Attendance System',
            email: process.env.EMAIL_FROM
          },
          to: [{ email: email, name: employeeName }],
          subject: 'Attendance System - Password Reset OTP',
          htmlContent: htmlContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Brevo API Response:', errorData);
        throw new Error(`Brevo API error: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Email sent successfully via Brevo:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId
      };
    }
    
    // Fallback to SMTP (won't work on Render free tier)
    const transportConfig = {
      host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS || process.env.BREVO_SMTP_KEY
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    };

    const transporter = nodemailer.createTransport(transportConfig);

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Attendance System'}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Attendance System - Password Reset OTP',
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully via SMTP:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const testEmailConfig = async () => {
  try {
    // Test Brevo API connection
    if (process.env.BREVO_API_KEY) {
      const response = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY
        }
      });

      if (!response.ok) {
        throw new Error(`Brevo API connection failed: ${response.statusText}`);
      }

      return { success: true, message: 'Brevo API connection is valid' };
    }

    // Test SMTP connection
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS || process.env.BREVO_SMTP_KEY
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });
    
    await transporter.verify();
    return { success: true, message: 'Email configuration is valid' };
  } catch (error) {
    console.error('Email configuration error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTPEmail,
  testEmailConfig
};
