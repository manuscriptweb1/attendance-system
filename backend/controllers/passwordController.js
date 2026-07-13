const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { sendOTPEmail } = require('../services/emailService');
const { 
  createOTP, 
  verifyOTPCode, 
  checkOTPWithoutMarking,
  invalidateOTPs, 
  checkRateLimit, 
  canResendOTP 
} = require('../services/otpService');
const { logAudit, AUDIT_ACTIONS, AUDIT_STATUS } = require('../services/auditService');

// Utility function to mask email
const maskEmail = (email) => {
  if (!email) return '';
  const [username, domain] = email.split('@');
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  const visibleChars = 2;
  const maskedPart = '*'.repeat(Math.min(5, username.length - visibleChars));
  return `${username.substring(0, visibleChars)}${maskedPart}@${domain}`;
};

// Validate password strength
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 64) {
    errors.push('Password must not exceed 64 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// FEATURE 1: CHANGE PASSWORD (Logged-in users)

// Step 1: Request password change (verify current password and send OTP)
const requestPasswordChange = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const employeeId = req.user.employee_id; // From JWT
    const userId = req.user.employee_id;

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required'
      });
    }

    // Get employee details
    const empResult = await pool.query(
      'SELECT * FROM employees WHERE employee_id = $1',
      [employeeId]
    );

    if (empResult.rows.length === 0) {
      await logAudit({
        userId,
        userType: 'employee',
        action: AUDIT_ACTIONS.PASSWORD_CHANGE_REQUESTED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Employee not found' }
      });

      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const employee = empResult.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, employee.password);

    if (!isValidPassword) {
      await logAudit({
        userId,
        userType: 'employee',
        action: AUDIT_ACTIONS.PASSWORD_CHANGE_REQUESTED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Invalid current password' }
      });

      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check rate limiting
    const rateLimit = await checkRateLimit(employeeId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many OTP requests. Please try again in ${rateLimit.resetInMinutes} minutes.`
      });
    }

    // Check resend cooldown
    const resendCheck = await canResendOTP(employeeId);
    if (!resendCheck.canResend) {
      return res.status(429).json({
        success: false,
        message: resendCheck.message
      });
    }

    // Generate and send OTP
    const otpResult = await createOTP(employeeId, 'password_change');
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate OTP. Please try again.'
      });
    }

    // Send OTP email
    const emailResult = await sendOTPEmail(
      employee.email,
      employee.name,
      otpResult.otp,
      otpResult.expiryMinutes,
      'password_change'
    );

    if (!emailResult.success) {
      await logAudit({
        userId,
        userType: 'employee',
        action: AUDIT_ACTIONS.OTP_SENT,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Email sending failed', error: emailResult.error }
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.'
      });
    }

    // Log successful OTP send
    await logAudit({
      userId,
      userType: 'employee',
      action: AUDIT_ACTIONS.PASSWORD_CHANGE_REQUESTED,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { maskedEmail: maskEmail(employee.email) }
    });

    res.json({
      success: true,
      message: 'OTP sent to your registered email address',
      maskedEmail: maskEmail(employee.email),
      expiresInMinutes: otpResult.expiryMinutes
    });

  } catch (error) {
    console.error('Request password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// Step 2: Complete password change (verify OTP and update password)
const completePasswordChange = async (req, res) => {
  try {
    const { otp, newPassword, confirmNewPassword } = req.body;
    const employeeId = req.user.employee_id; // From JWT
    const userId = req.user.employee_id;

    // Validate inputs
    if (!otp || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if passwords match
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    // Get employee details
    const empResult = await pool.query(
      'SELECT * FROM employees WHERE employee_id = $1',
      [employeeId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const employee = empResult.rows[0];

    // Check if new password is same as current password
    const isSameAsCurrentPassword = await bcrypt.compare(newPassword, employee.password);
    if (isSameAsCurrentPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as your current password'
      });
    }

    // Verify OTP
    const otpVerification = await verifyOTPCode(employeeId, otp, 'password_change');
    if (!otpVerification.success) {
      await logAudit({
        userId,
        userType: 'employee',
        action: AUDIT_ACTIONS.OTP_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: otpVerification.error }
      });

      return res.status(400).json({
        success: false,
        message: otpVerification.error
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE employees SET password = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $2',
      [hashedPassword, employeeId]
    );

    // Invalidate all OTPs
    await invalidateOTPs(employeeId);

    // Log successful password change
    await logAudit({
      userId,
      userType: 'employee',
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Password changed successfully!'
    });

  } catch (error) {
    console.error('Complete password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// FEATURE 2: FORGOT PASSWORD (Not logged in)

// Step 1: Request password reset (send OTP to email)
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if employee exists with this email
    const empResult = await pool.query(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    // Always return same generic message to prevent account enumeration
    const genericMessage = 'If an account exists with this email, an OTP has been sent.';

    if (empResult.rows.length === 0) {
      // Employee doesn't exist - return generic message without sending email
      // Still log the attempt for security monitoring
      await logAudit({
        userId: email,
        userType: 'employee',
        action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Email not found' }
      });

      return res.json({
        success: true,
        message: genericMessage
      });
    }

    const employee = empResult.rows[0];
    const employeeId = employee.employee_id;

    // Check rate limiting
    const rateLimit = await checkRateLimit(employeeId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many reset requests. Please try again in ${rateLimit.resetInMinutes} minutes.`
      });
    }

    // Check resend cooldown
    const resendCheck = await canResendOTP(employeeId);
    if (!resendCheck.canResend) {
      return res.status(429).json({
        success: false,
        message: resendCheck.message
      });
    }

    // Generate and send OTP
    const otpResult = await createOTP(employeeId, 'password_reset');
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate OTP. Please try again.'
      });
    }

    // Send OTP email
    const emailResult = await sendOTPEmail(
      employee.email,
      employee.name,
      otpResult.otp,
      otpResult.expiryMinutes,
      'password_reset'
    );

    if (!emailResult.success) {
      await logAudit({
        userId: employeeId,
        userType: 'employee',
        action: AUDIT_ACTIONS.OTP_SENT,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Email sending failed', error: emailResult.error }
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.'
      });
    }

    // Log successful OTP send
    await logAudit({
      userId: employeeId,
      userType: 'employee',
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { maskedEmail: maskEmail(employee.email) }
    });

    res.json({
      success: true,
      message: genericMessage,
      maskedEmail: maskEmail(employee.email),
      expiresInMinutes: otpResult.expiryMinutes
    });

  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// Step 2: Verify OTP
const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Get employee by email
    const empResult = await pool.query(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid request'
      });
    }

    const employee = empResult.rows[0];
    const employeeId = employee.employee_id;

    // Verify OTP without marking as used (user still needs to complete password reset)
    const otpVerification = await checkOTPWithoutMarking(employeeId, otp, 'password_reset');
    
    if (!otpVerification.success) {
      await logAudit({
        userId: employeeId,
        userType: 'employee',
        action: AUDIT_ACTIONS.OTP_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: otpVerification.error }
      });

      return res.status(400).json({
        success: false,
        message: otpVerification.error
      });
    }

    // Log successful OTP verification
    await logAudit({
      userId: employeeId,
      userType: 'employee',
      action: AUDIT_ACTIONS.OTP_VERIFIED,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// Step 3: Reset password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmNewPassword } = req.body;

    // Validate inputs
    if (!email || !otp || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if passwords match
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet requirements',
        errors: passwordValidation.errors
      });
    }

    // Get employee by email
    const empResult = await pool.query(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid request'
      });
    }

    const employee = empResult.rows[0];
    const employeeId = employee.employee_id;

    // Verify OTP but don't mark as used yet (we'll mark it used after password reset succeeds)
    // First check if OTP exists and is valid
    const otpCheck = await pool.query(
      `SELECT * FROM password_reset_otps 
       WHERE employee_id = $1 
       AND purpose = 'password_reset' 
       AND used = FALSE 
       AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [employeeId]
    );

    if (otpCheck.rows.length === 0) {
      await logAudit({
        userId: employeeId,
        userType: 'employee',
        action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'No valid OTP found' }
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.'
      });
    }

    const otpRecord = otpCheck.rows[0];

    // Verify the OTP hash matches
    const bcrypt = require('bcrypt');
    const isValidOTP = await bcrypt.compare(otp, otpRecord.otp_hash);

    if (!isValidOTP) {
      await logAudit({
        userId: employeeId,
        userType: 'employee',
        action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Invalid OTP' }
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // Check if new password is same as current password
    const isSameAsCurrentPassword = await bcrypt.compare(newPassword, employee.password);
    if (isSameAsCurrentPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as your current password'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE employees SET password = $1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $2',
      [hashedPassword, employeeId]
    );

    // Invalidate all OTPs
    await invalidateOTPs(employeeId);

    // Log successful password reset
    await logAudit({
      userId: employeeId,
      userType: 'employee',
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Password reset successfully! You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email and purpose are required'
      });
    }

    if (!['password_reset', 'password_change'].includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purpose'
      });
    }

    // Get employee by email
    const empResult = await pool.query(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (empResult.rows.length === 0) {
      // Return generic message to prevent account enumeration
      return res.json({
        success: true,
        message: 'If an account exists with this email, an OTP has been sent.'
      });
    }

    const employee = empResult.rows[0];
    const employeeId = employee.employee_id;

    // Check rate limiting
    const rateLimit = await checkRateLimit(employeeId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many OTP requests. Please try again in ${rateLimit.resetInMinutes} minutes.`
      });
    }

    // Check resend cooldown
    const resendCheck = await canResendOTP(employeeId);
    if (!resendCheck.canResend) {
      return res.status(429).json({
        success: false,
        message: resendCheck.message,
        remainingSeconds: resendCheck.remainingSeconds
      });
    }

    // Generate and send new OTP
    const otpResult = await createOTP(employeeId, purpose);
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate OTP. Please try again.'
      });
    }

    // Send OTP email
    const emailResult = await sendOTPEmail(
      employee.email,
      employee.name,
      otpResult.otp,
      otpResult.expiryMinutes,
      purpose
    );

    if (!emailResult.success) {
      await logAudit({
        userId: employeeId,
        userType: 'employee',
        action: AUDIT_ACTIONS.OTP_RESENT,
        status: AUDIT_STATUS.FAILED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Email sending failed', error: emailResult.error }
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.'
      });
    }

    // Log successful OTP resend
    await logAudit({
      userId: employeeId,
      userType: 'employee',
      action: AUDIT_ACTIONS.OTP_RESENT,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { purpose, maskedEmail: maskEmail(employee.email) }
    });

    res.json({
      success: true,
      message: 'New OTP sent successfully',
      expiresInMinutes: otpResult.expiryMinutes
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

module.exports = {
  requestPasswordChange,
  completePasswordChange,
  requestPasswordReset,
  verifyResetOTP,
  resetPassword,
  resendOTP
};
