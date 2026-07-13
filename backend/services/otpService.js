const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');

// Generate secure 6-digit OTP using crypto
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Hash OTP for secure storage
const hashOTP = async (otp) => {
  return await bcrypt.hash(otp, 12);
};

// Verify OTP against hash
const verifyOTP = async (otp, hash) => {
  return await bcrypt.compare(otp, hash);
};

// Get OTP settings from database
const getOTPSettings = async () => {
  try {
    const result = await pool.query(
      'SELECT otp_expiry_minutes, otp_resend_seconds, otp_max_attempts, otp_requests_per_hour FROM settings ORDER BY id LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      // Fallback to default values
      return {
        otp_expiry_minutes: 5,
        otp_resend_seconds: 60,
        otp_max_attempts: 3,
        otp_requests_per_hour: 5
      };
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching OTP settings:', error);
    // Return default values on error
    return {
      otp_expiry_minutes: 5,
      otp_resend_seconds: 60,
      otp_max_attempts: 3,
      otp_requests_per_hour: 5
    };
  }
};

// Check rate limiting for OTP requests
const checkRateLimit = async (employeeId) => {
  try {
    const settings = await getOTPSettings();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check if rate limit record exists
    const result = await pool.query(
      'SELECT * FROM otp_rate_limits WHERE employee_id = $1',
      [employeeId]
    );

    if (result.rows.length === 0) {
      // No record exists, create one
      await pool.query(
        'INSERT INTO otp_rate_limits (employee_id, request_count, window_start) VALUES ($1, 1, CURRENT_TIMESTAMP)',
        [employeeId]
      );
      return { allowed: true, remainingRequests: settings.otp_requests_per_hour - 1 };
    }

    const rateLimit = result.rows[0];
    const windowStart = new Date(rateLimit.window_start);

    // Check if window has expired (more than 1 hour old)
    if (windowStart < hourAgo) {
      // Reset the window
      await pool.query(
        'UPDATE otp_rate_limits SET request_count = 1, window_start = CURRENT_TIMESTAMP WHERE employee_id = $1',
        [employeeId]
      );
      return { allowed: true, remainingRequests: settings.otp_requests_per_hour - 1 };
    }

    // Window is still active, check count
    if (rateLimit.request_count >= settings.otp_requests_per_hour) {
      const resetTime = new Date(windowStart.getTime() + 60 * 60 * 1000);
      const minutesUntilReset = Math.ceil((resetTime - new Date()) / 60000);
      return { 
        allowed: false, 
        remainingRequests: 0,
        resetInMinutes: minutesUntilReset 
      };
    }

    // Increment count
    await pool.query(
      'UPDATE otp_rate_limits SET request_count = request_count + 1 WHERE employee_id = $1',
      [employeeId]
    );

    return { 
      allowed: true, 
      remainingRequests: settings.otp_requests_per_hour - rateLimit.request_count - 1 
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but log it
    return { allowed: true, error: error.message };
  }
};

// Check if employee can resend OTP (cooldown period)
const canResendOTP = async (employeeId) => {
  try {
    const settings = await getOTPSettings();
    
    const result = await pool.query(
      `SELECT last_sent_at FROM password_reset_otps 
       WHERE employee_id = $1 AND used = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [employeeId]
    );

    if (result.rows.length === 0) {
      return { canResend: true };
    }

    const lastSentAt = new Date(result.rows[0].last_sent_at);
    const now = new Date();
    const secondsSinceLastSent = Math.floor((now - lastSentAt) / 1000);

    if (secondsSinceLastSent < settings.otp_resend_seconds) {
      const remainingSeconds = settings.otp_resend_seconds - secondsSinceLastSent;
      return { 
        canResend: false, 
        remainingSeconds,
        message: `Please wait ${remainingSeconds} seconds before requesting a new OTP`
      };
    }

    return { canResend: true };
  } catch (error) {
    console.error('Resend check error:', error);
    return { canResend: true, error: error.message };
  }
};

// Create OTP record
const createOTP = async (employeeId, purpose = 'password_reset') => {
  try {
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const settings = await getOTPSettings();
    
    const expiresAt = new Date(Date.now() + settings.otp_expiry_minutes * 60 * 1000);

    // Invalidate any existing OTPs for this employee and purpose
    await pool.query(
      'UPDATE password_reset_otps SET used = TRUE WHERE employee_id = $1 AND purpose = $2 AND used = FALSE',
      [employeeId, purpose]
    );

    // Create new OTP record
    const result = await pool.query(
      `INSERT INTO password_reset_otps (employee_id, otp_hash, purpose, expires_at, attempts, used, last_sent_at)
       VALUES ($1, $2, $3, $4, 0, FALSE, CURRENT_TIMESTAMP)
       RETURNING id`,
      [employeeId, otpHash, purpose, expiresAt]
    );

    return {
      success: true,
      otp,  // Plain text OTP to send via email (never store this)
      otpId: result.rows[0].id,
      expiresAt,
      expiryMinutes: settings.otp_expiry_minutes
    };
  } catch (error) {
    console.error('Create OTP error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Verify OTP
const verifyOTPCode = async (employeeId, otp, purpose = 'password_reset') => {
  try {
    const settings = await getOTPSettings();

    // Get active OTP record
    const result = await pool.query(
      `SELECT * FROM password_reset_otps 
       WHERE employee_id = $1 AND purpose = $2 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [employeeId, purpose]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'No valid OTP found. Please request a new OTP.'
      };
    }

    const otpRecord = result.rows[0];

    // Check if max attempts exceeded
    if (otpRecord.attempts >= settings.otp_max_attempts) {
      // Mark as used to prevent further attempts
      await pool.query(
        'UPDATE password_reset_otps SET used = TRUE WHERE id = $1',
        [otpRecord.id]
      );
      
      return {
        success: false,
        error: `Maximum verification attempts (${settings.otp_max_attempts}) exceeded. Please request a new OTP.`
      };
    }

    // Verify OTP
    const isValid = await verifyOTP(otp, otpRecord.otp_hash);

    if (!isValid) {
      // Increment attempt count
      await pool.query(
        'UPDATE password_reset_otps SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [otpRecord.id]
      );

      const remainingAttempts = settings.otp_max_attempts - (otpRecord.attempts + 1);
      return {
        success: false,
        error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts
      };
    }

    // OTP is valid - mark as used
    await pool.query(
      'UPDATE password_reset_otps SET used = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [otpRecord.id]
    );

    return {
      success: true,
      message: 'OTP verified successfully',
      otpId: otpRecord.id
    };
  } catch (error) {
    console.error('Verify OTP error:', error);
    return {
      success: false,
      error: 'OTP verification failed. Please try again.'
    };
  }
};

// Invalidate all OTPs for an employee
const invalidateOTPs = async (employeeId, purpose = null) => {
  try {
    let query = 'UPDATE password_reset_otps SET used = TRUE WHERE employee_id = $1';
    const params = [employeeId];

    if (purpose) {
      query += ' AND purpose = $2';
      params.push(purpose);
    }

    await pool.query(query, params);
    return { success: true };
  } catch (error) {
    console.error('Invalidate OTPs error:', error);
    return { success: false, error: error.message };
  }
};

// Verify OTP without marking as used (for step 2 verification)
const checkOTPWithoutMarking = async (employeeId, otp, purpose = 'password_reset') => {
  try {
    const settings = await getOTPSettings();

    // Get active OTP record
    const result = await pool.query(
      `SELECT * FROM password_reset_otps 
       WHERE employee_id = $1 AND purpose = $2 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [employeeId, purpose]
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'No valid OTP found. Please request a new OTP.'
      };
    }

    const otpRecord = result.rows[0];

    // Check if max attempts exceeded
    if (otpRecord.attempts >= settings.otp_max_attempts) {
      return {
        success: false,
        error: `Maximum verification attempts (${settings.otp_max_attempts}) exceeded. Please request a new OTP.`
      };
    }

    // Verify OTP
    const isValid = await verifyOTP(otp, otpRecord.otp_hash);

    if (!isValid) {
      // Increment attempt count but don't mark as used
      await pool.query(
        'UPDATE password_reset_otps SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [otpRecord.id]
      );

      const remainingAttempts = settings.otp_max_attempts - (otpRecord.attempts + 1);
      return {
        success: false,
        error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        remainingAttempts
      };
    }

    // OTP is valid but DON'T mark as used yet
    return {
      success: true,
      message: 'OTP verified successfully',
      otpId: otpRecord.id
    };
  } catch (error) {
    console.error('Check OTP error:', error);
    return {
      success: false,
      error: 'OTP verification failed. Please try again.'
    };
  }
};

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP,
  getOTPSettings,
  checkRateLimit,
  canResendOTP,
  createOTP,
  verifyOTPCode,
  checkOTPWithoutMarking,
  invalidateOTPs
};
