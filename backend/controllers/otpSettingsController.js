const pool = require('../config/database');
const { logAudit, AUDIT_ACTIONS, AUDIT_STATUS } = require('../services/auditService');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

// Get OTP settings
const getOTPSettings = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT otp_expiry_minutes, otp_resend_seconds, otp_max_attempts, otp_requests_per_hour FROM settings ORDER BY id LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    res.json({
      success: true,
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Get OTP settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading OTP settings'
    });
  }
};

// Update OTP settings
const updateOTPSettings = async (req, res) => {
  try {
    const {
      otp_expiry_minutes,
      otp_resend_seconds,
      otp_max_attempts,
      otp_requests_per_hour
    } = req.body;

    // Validation
    if (
      otp_expiry_minutes === undefined ||
      otp_resend_seconds === undefined ||
      otp_max_attempts === undefined ||
      otp_requests_per_hour === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'All OTP settings fields are required'
      });
    }

    // Validate ranges
    if (otp_expiry_minutes < 1 || otp_expiry_minutes > 60) {
      return res.status(400).json({
        success: false,
        message: 'OTP expiry must be between 1 and 60 minutes'
      });
    }

    if (otp_resend_seconds < 30 || otp_resend_seconds > 300) {
      return res.status(400).json({
        success: false,
        message: 'OTP resend cooldown must be between 30 and 300 seconds'
      });
    }

    if (otp_max_attempts < 1 || otp_max_attempts > 10) {
      return res.status(400).json({
        success: false,
        message: 'OTP max attempts must be between 1 and 10'
      });
    }

    if (otp_requests_per_hour < 1 || otp_requests_per_hour > 20) {
      return res.status(400).json({
        success: false,
        message: 'OTP requests per hour must be between 1 and 20'
      });
    }

    // Update settings
    const updateQuery = `
      UPDATE settings SET
        otp_expiry_minutes = $1,
        otp_resend_seconds = $2,
        otp_max_attempts = $3,
        otp_requests_per_hour = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM settings ORDER BY id LIMIT 1)
      RETURNING *
    `;

    const values = [
      parseInt(otp_expiry_minutes),
      parseInt(otp_resend_seconds),
      parseInt(otp_max_attempts),
      parseInt(otp_requests_per_hour)
    ];

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    // Log the settings update
    await logAudit({
      userId: req.user.id.toString(),
      userType: 'admin',
      action: AUDIT_ACTIONS.OTP_SETTINGS_UPDATED,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        otp_expiry_minutes,
        otp_resend_seconds,
        otp_max_attempts,
        otp_requests_per_hour
      }
    });

    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_OTP_SETTINGS,
      moduleName: MODULE_NAMES.SETTINGS,
      description: 'Updated OTP settings',
      newData: { otp_expiry_minutes, otp_resend_seconds, otp_max_attempts, otp_requests_per_hour },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'OTP settings updated successfully! Changes apply immediately.',
      settings: {
        otp_expiry_minutes,
        otp_resend_seconds,
        otp_max_attempts,
        otp_requests_per_hour
      }
    });

  } catch (error) {
    console.error('Update OTP settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating OTP settings'
    });
  }
};

module.exports = {
  getOTPSettings,
  updateOTPSettings
};
