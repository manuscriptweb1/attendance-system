const pool = require('../config/database');
const { logAudit, AUDIT_ACTIONS, AUDIT_STATUS } = require('../services/auditService');

// Get audit logs (employee activities only)
const getAuditLogs = async (req, res) => {
  try {
    const { limit = 100, employeeId, action, status } = req.query;

    let query = `
      SELECT 
        al.*,
        al.created_at AT TIME ZONE 'UTC' AS created_at_utc,
        e.name as employee_name
      FROM audit_logs al
      LEFT JOIN employees e ON al.user_id = e.employee_id
      WHERE al.user_type = 'employee'
    `;
    const params = [];
    let paramCount = 1;

    if (employeeId) {
      query += ` AND al.user_id = $${paramCount}`;
      params.push(employeeId);
      paramCount++;
    }

    if (action) {
      query += ` AND al.action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    if (status) {
      query += ` AND al.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      logs: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit logs'
    });
  }
};

// Get device fingerprints
const getDeviceFingerprints = async (req, res) => {
  try {
    const { employeeId } = req.query;

    let query = `
      SELECT 
        df.*,
        e.name as employee_name,
        e.email as employee_email
      FROM device_fingerprints df
      LEFT JOIN employees e ON df.employee_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (employeeId) {
      query += ` AND df.employee_id = $1`;
      params.push(employeeId);
    }

    query += ` ORDER BY df.last_seen_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      devices: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get device fingerprints error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device fingerprints'
    });
  }
};

// Get rate limits
const getRateLimits = async (req, res) => {
  try {
    const { employeeId } = req.query;

    let query = `
      SELECT 
        arl.*,
        e.name as employee_name,
        e.email as employee_email
      FROM attendance_rate_limits arl
      LEFT JOIN employees e ON arl.employee_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (employeeId) {
      query += ` AND arl.employee_id = $1`;
      params.push(employeeId);
    }

    query += ` ORDER BY arl.window_start DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get rate limits error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rate limits'
    });
  }
};

// Get security statistics
const getSecurityStats = async (req, res) => {
  try {
    // Total audit logs today
    const auditLogsToday = await pool.query(
      `SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Failed attempts today
    const failedAttemptsToday = await pool.query(
      `SELECT COUNT(*) FROM audit_logs 
       WHERE DATE(created_at) = CURRENT_DATE AND status = 'failed'`
    );

    // Unique devices
    const uniqueDevices = await pool.query(
      `SELECT COUNT(*) FROM device_fingerprints`
    );

    // Active rate limits (within last minute)
    const activeRateLimits = await pool.query(
      `SELECT COUNT(*) FROM attendance_rate_limits 
       WHERE window_start > NOW() - INTERVAL '1 minute'`
    );

    // Most active users today
    const mostActiveUsers = await pool.query(
      `SELECT 
        user_id,
        COUNT(*) as activity_count,
        e.name as employee_name
       FROM audit_logs al
       LEFT JOIN employees e ON al.user_id = e.employee_id
       WHERE DATE(created_at) = CURRENT_DATE
       GROUP BY user_id, e.name
       ORDER BY activity_count DESC
       LIMIT 5`
    );

    // Validation method breakdown (last 7 days)
    const validationBreakdown = await pool.query(
      `SELECT 
        validation_method,
        COUNT(*) as count
       FROM attendance
       WHERE attendance_date >= CURRENT_DATE - INTERVAL '7 days'
       AND validation_method IS NOT NULL
       GROUP BY validation_method`
    );

    res.json({
      success: true,
      stats: {
        auditLogsToday: parseInt(auditLogsToday.rows[0].count),
        failedAttemptsToday: parseInt(failedAttemptsToday.rows[0].count),
        uniqueDevices: parseInt(uniqueDevices.rows[0].count),
        activeRateLimits: parseInt(activeRateLimits.rows[0].count),
        mostActiveUsers: mostActiveUsers.rows,
        validationBreakdown: validationBreakdown.rows
      }
    });
  } catch (error) {
    console.error('Get security stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching security statistics'
    });
  }
};

// Clear rate limit for employee (admin action)
const clearRateLimit = async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    await pool.query(
      'DELETE FROM attendance_rate_limits WHERE employee_id = $1',
      [employeeId]
    );

    res.json({
      success: true,
      message: `Rate limit cleared for employee ${employeeId}`
    });
  } catch (error) {
    console.error('Clear rate limit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing rate limit'
    });
  }
};

// Update device alias (admin only)
const updateDeviceAlias = async (req, res) => {
  try {
    const { id } = req.params;
    const { device_alias } = req.body;
    const adminId = req.user.id; // Admin user from JWT

    if (!device_alias || device_alias.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Device alias is required'
      });
    }

    // Trim and validate alias
    const trimmedAlias = device_alias.trim();
    if (trimmedAlias.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Device alias must be 255 characters or less'
      });
    }

    // Get current device info for audit
    const currentDevice = await pool.query(
      'SELECT * FROM device_fingerprints WHERE id = $1',
      [id]
    );

    if (currentDevice.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const oldAlias = currentDevice.rows[0].device_alias;

    // Update device alias
    const result = await pool.query(
      `UPDATE device_fingerprints 
       SET device_alias = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [trimmedAlias, id]
    );

    // Log audit event
    await logAudit({
      userId: `admin_${adminId}`,
      userType: 'admin',
      action: oldAlias ? 'device_alias_updated' : 'device_alias_created',
      status: 'success',
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      details: {
        deviceId: id,
        employeeId: currentDevice.rows[0].employee_id,
        oldAlias: oldAlias || null,
        newAlias: trimmedAlias,
        adminId: adminId
      }
    });

    res.json({
      success: true,
      message: 'Device alias updated successfully',
      device: result.rows[0]
    });
  } catch (error) {
    console.error('Update device alias error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating device alias'
    });
  }
};

/**
 * @desc    Clear security audit logs for a date range
 * @route   DELETE /api/security/clear-range
 * @access  Private/Admin
 */
const clearSecurityLogRange = async (req, res) => {
  try {
    const { fromDate, toDate, confirmText } = req.body;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'From Date and To Date are required' });
    }
    
    if (confirmText !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Invalid confirmation text' });
    }
    
    if (new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({ success: false, message: 'From Date cannot be after To Date' });
    }

    const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
    const adminId = req.user.id;
    const adminName = req.user.name;

    const result = await pool.query(
      'DELETE FROM audit_logs WHERE DATE(created_at) BETWEEN $1 AND $2 RETURNING id',
      [fromDate, toDate]
    );

    // Log the action
    await logAdminActivity({
      adminId,
      adminName,
      actionType: ADMIN_ACTION_TYPES.CLEAR_RANGE,
      moduleName: MODULE_NAMES.SECURITY,
      description: `Cleared security audit logs from ${fromDate} to ${toDate}. Count: ${result.rowCount}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Security logs cleared successfully',
      deletedCount: result.rowCount
    });

  } catch (error) {
    console.error('Clear security log range error:', error);
    res.status(500).json({ success: false, message: 'Server error while clearing records' });
  }
};

module.exports = {
  getAuditLogs,
  getDeviceFingerprints,
  getRateLimits,
  getSecurityStats,
  clearRateLimit,
  updateDeviceAlias,
  clearSecurityLogRange
};
