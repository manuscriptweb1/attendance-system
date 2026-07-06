const pool = require('../config/database');

// Log audit event
const logAudit = async ({
  userId,
  userType,
  action,
  status,
  ipAddress = null,
  userAgent = null,
  deviceFingerprint = null,
  details = null
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_type, action, status, ip_address, user_agent, device_fingerprint, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'UTC')`,
      [
        userId,
        userType,
        action,
        status,
        ipAddress,
        userAgent,
        deviceFingerprint,
        details ? JSON.stringify(details) : null
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Audit logging error:', error);
    // Don't throw error - audit logging failure shouldn't break main functionality
    return { success: false, error: error.message };
  }
};

// Get audit logs with filters
const getAuditLogs = async (filters = {}) => {
  try {
    let query = 'SELECT *, created_at AT TIME ZONE \'UTC\' AS created_at_utc FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.userId) {
      query += ` AND user_id = $${paramCount}`;
      params.push(filters.userId);
      paramCount++;
    }

    if (filters.userType) {
      query += ` AND user_type = $${paramCount}`;
      params.push(filters.userType);
      paramCount++;
    }

    if (filters.action) {
      query += ` AND action = $${paramCount}`;
      params.push(filters.action);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(filters.startDate);
      paramCount++;
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(filters.endDate);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await pool.query(query, params);
    return {
      success: true,
      logs: result.rows
    };
  } catch (error) {
    console.error('Get audit logs error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Audit Actions Constants
const AUDIT_ACTIONS = {
  PASSWORD_CHANGE_REQUESTED: 'password_change_requested',
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  OTP_SENT: 'otp_sent',
  OTP_RESENT: 'otp_resent',
  OTP_VERIFIED: 'otp_verified',
  OTP_FAILED: 'otp_verification_failed',
  OTP_SETTINGS_UPDATED: 'otp_settings_updated',
  LOGIN: 'login',
  LOGOUT: 'logout',
  FAILED_LOGIN: 'failed_login',
  // Attendance Actions
  CHECKIN_SUCCESS: 'checkin_success',
  CHECKIN_FAILED: 'checkin_failed',
  CHECKOUT_SUCCESS: 'checkout_success',
  CHECKOUT_FAILED: 'checkout_failed',
  LOCATION_VALIDATION_FAILED: 'location_validation_failed',
  NETWORK_VALIDATION_FAILED: 'network_validation_failed',
  RATE_LIMIT_EXCEEDED: 'attendance_rate_limit_exceeded',
  UNAUTHORIZED_ACCESS: 'unauthorized_access_attempt'
};

// Audit Status Constants
const AUDIT_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending'
};

module.exports = {
  logAudit,
  getAuditLogs,
  AUDIT_ACTIONS,
  AUDIT_STATUS
};
