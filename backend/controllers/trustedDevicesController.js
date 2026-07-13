const pool = require('../config/database');
const { logAudit, AUDIT_ACTIONS, AUDIT_STATUS } = require('../services/auditService');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

// Get all trusted devices with filtering
const getAllTrustedDevices = async (req, res) => {
  try {
    const { status, search, deviceType, employeeId } = req.query;

    let query = `
      SELECT td.*, e.name as employee_name, e.job_role, d.name as department
      FROM trusted_devices td
      LEFT JOIN employees e ON td.employee_id = e.employee_id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    // Filter by approval status
    if (status) {
      query += ` AND td.approved_status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    // Filter by device type
    if (deviceType) {
      query += ` AND td.device_type = $${paramCount}`;
      values.push(deviceType);
      paramCount++;
    }

    // Filter by employee ID
    if (employeeId) {
      query += ` AND td.employee_id = $${paramCount}`;
      values.push(employeeId);
      paramCount++;
    }

    // Search by employee name or device alias
    if (search) {
      query += ` AND (td.employee_name ILIKE $${paramCount} OR td.device_alias ILIKE $${paramCount} OR td.employee_id ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY td.created_at DESC';

    const result = await pool.query(query, values);

    res.json({
      success: true,
      devices: result.rows
    });

  } catch (error) {
    console.error('Get trusted devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get device statistics for dashboard
const getDeviceStats = async (req, res) => {
  try {
    const pendingCount = await pool.query(
      "SELECT COUNT(*) FROM trusted_devices WHERE approved_status = 'Pending'"
    );

    const approvedCount = await pool.query(
      "SELECT COUNT(*) FROM trusted_devices WHERE approved_status = 'Approved'"
    );

    const rejectedCount = await pool.query(
      "SELECT COUNT(*) FROM trusted_devices WHERE approved_status = 'Rejected'"
    );

    const blockedCount = await pool.query(
      "SELECT COUNT(*) FROM trusted_devices WHERE approved_status = 'Blocked'"
    );

    const totalCount = await pool.query(
      'SELECT COUNT(*) FROM trusted_devices'
    );

    res.json({
      success: true,
      stats: {
        pendingDevices: parseInt(pendingCount.rows[0].count),
        approvedDevices: parseInt(approvedCount.rows[0].count),
        rejectedDevices: parseInt(rejectedCount.rows[0].count),
        blockedDevices: parseInt(blockedCount.rows[0].count),
        totalDevices: parseInt(totalCount.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Get device stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Approve device
const approveDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const adminId = req.user.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Get device info
    const deviceCheck = await pool.query(
      'SELECT * FROM trusted_devices WHERE id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceCheck.rows[0];

    // Update device status
    const result = await pool.query(
      `UPDATE trusted_devices 
       SET approved_status = 'Approved',
           approved_by = $1,
           approved_at = CURRENT_TIMESTAMP,
           rejected_by = NULL,
           rejected_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [adminId, deviceId]
    );

    // Log audit
    const clientIP = getClientIP(req);
    await logAudit({
      userId: req.user.username,
      userType: 'admin',
      action: AUDIT_ACTIONS.DEVICE_APPROVED || 'device_approved',
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      details: {
        deviceId,
        employeeId: device.employee_id,
        deviceAlias: device.device_alias,
        deviceType: device.device_type
      }
    });

    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.APPROVE_DEVICE,
      moduleName: MODULE_NAMES.DEVICE,
      description: `Approved device for employee ${device.employee_id} - ${device.employee_name}`,
      newData: { deviceId, employeeId: device.employee_id, deviceAlias: device.device_alias },
      ipAddress: clientIP,
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Device approved successfully',
      device: result.rows[0]
    });

  } catch (error) {
    console.error('Approve device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Reject device
const rejectDevice = async (req, res) => {
  try {
    const { deviceId, remarks } = req.body;
    const adminId = req.user.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Get device info
    const deviceCheck = await pool.query(
      'SELECT * FROM trusted_devices WHERE id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceCheck.rows[0];

    // Update device status
    const result = await pool.query(
      `UPDATE trusted_devices 
       SET approved_status = 'Rejected',
           rejected_by = $1,
           rejected_at = CURRENT_TIMESTAMP,
           approved_by = NULL,
           approved_at = NULL,
           remarks = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [adminId, remarks || null, deviceId]
    );

    // Log audit
    const clientIP = getClientIP(req);
    await logAudit({
      userId: req.user.username,
      userType: 'admin',
      action: AUDIT_ACTIONS.DEVICE_REJECTED || 'device_rejected',
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      details: {
        deviceId,
        employeeId: device.employee_id,
        deviceAlias: device.device_alias,
        remarks
      }
    });

    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.REJECT_DEVICE,
      moduleName: MODULE_NAMES.DEVICE,
      description: `Rejected device for employee ${device.employee_id} - ${device.employee_name}`,
      newData: { deviceId, employeeId: device.employee_id, deviceAlias: device.device_alias, remarks },
      ipAddress: clientIP,
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Device rejected successfully',
      device: result.rows[0]
    });

  } catch (error) {
    console.error('Reject device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update device alias
const updateDeviceAlias = async (req, res) => {
  try {
    const { deviceId, deviceAlias } = req.body;

    if (!deviceId || !deviceAlias) {
      return res.status(400).json({
        success: false,
        message: 'Device ID and alias are required'
      });
    }

    if (deviceAlias.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Device alias must be 255 characters or less'
      });
    }

    // Get device info
    const deviceCheck = await pool.query(
      'SELECT * FROM trusted_devices WHERE id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceCheck.rows[0];

    // Update device alias
    const result = await pool.query(
      `UPDATE trusted_devices 
       SET device_alias = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [deviceAlias.trim(), deviceId]
    );

    // Log audit
    const clientIP = getClientIP(req);
    await logAudit({
      userId: req.user.username,
      userType: 'admin',
      action: AUDIT_ACTIONS.DEVICE_ALIAS_UPDATED || 'device_alias_updated',
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      details: {
        deviceId,
        employeeId: device.employee_id,
        oldAlias: device.device_alias,
        newAlias: deviceAlias.trim()
      }
    });

    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_DEVICE_ALIAS,
      moduleName: MODULE_NAMES.DEVICE,
      description: `Updated device alias for employee ${device.employee_id}`,
      oldData: { deviceAlias: device.device_alias },
      newData: { deviceAlias: deviceAlias.trim() },
      ipAddress: clientIP,
      browserInfo: req.headers['user-agent']
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
      message: 'Server error'
    });
  }
};

// Remove approval (set back to pending or delete)
const removeApproval = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const adminId = req.user.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Get device info
    const deviceCheck = await pool.query(
      'SELECT * FROM trusted_devices WHERE id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceCheck.rows[0];

    // Set back to pending
    const result = await pool.query(
      `UPDATE trusted_devices 
       SET approved_status = 'Pending',
           approved_by = NULL,
           approved_at = NULL,
           rejected_by = NULL,
           rejected_at = NULL,
           remarks = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [deviceId]
    );

    // Log audit
    const clientIP = getClientIP(req);
    await logAudit({
      userId: req.user.username,
      userType: 'admin',
      action: AUDIT_ACTIONS.DEVICE_APPROVAL_REMOVED || 'device_approval_removed',
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      details: {
        deviceId,
        employeeId: device.employee_id,
        previousStatus: device.approved_status
      }
    });

    res.json({
      success: true,
      message: 'Device approval removed successfully',
      device: result.rows[0]
    });

  } catch (error) {
    console.error('Remove approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Delete device
const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Get device info before deletion
    const deviceCheck = await pool.query(
      'SELECT * FROM trusted_devices WHERE id = $1',
      [id]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceCheck.rows[0];

    // Delete device
    await pool.query('DELETE FROM trusted_devices WHERE id = $1', [id]);

    // Log audit
    const clientIP = getClientIP(req);
    await logAudit({
      userId: req.user.username,
      userType: 'admin',
      action: AUDIT_ACTIONS.DEVICE_DELETED || 'device_deleted',
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      details: {
        deviceId: id,
        employeeId: device.employee_id,
        deviceAlias: device.device_alias
      }
    });

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });

  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Block device
const blockDevice = async (req, res) => {
  try {
    const { deviceId, remarks } = req.body;
    const adminId = req.user.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Get device info
    const deviceCheck = await pool.query(
      'SELECT * FROM trusted_devices WHERE id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceCheck.rows[0];

    // Update device status to Blocked
    const result = await pool.query(
      `UPDATE trusted_devices 
       SET approved_status = 'Blocked',
           rejected_by = $1,
           rejected_at = CURRENT_TIMESTAMP,
           approved_by = NULL,
           approved_at = NULL,
           remarks = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [adminId, remarks || null, deviceId]
    );

    // Log audit
    const clientIP = getClientIP(req);
    await logAudit({
      userId: req.user.username,
      userType: 'admin',
      action: AUDIT_ACTIONS.DEVICE_BLOCKED || 'device_blocked',
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      details: {
        deviceId,
        employeeId: device.employee_id,
        deviceAlias: device.device_alias,
        remarks
      }
    });

    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.BLOCK_DEVICE || 'BLOCK_DEVICE',
      moduleName: MODULE_NAMES.DEVICE,
      description: `Blocked device for employee ${device.employee_id} - ${device.employee_name}`,
      newData: { deviceId, employeeId: device.employee_id, deviceAlias: device.device_alias, remarks },
      ipAddress: clientIP,
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Device blocked successfully',
      device: result.rows[0]
    });

  } catch (error) {
    console.error('Block device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Unblock device
const unblockDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const adminId = req.user.id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Get device info
    const deviceCheck = await pool.query(
      'SELECT * FROM trusted_devices WHERE id = $1',
      [deviceId]
    );

    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceCheck.rows[0];

    // Update device status to Approved
    const result = await pool.query(
      `UPDATE trusted_devices 
       SET approved_status = 'Approved',
           approved_by = $1,
           approved_at = CURRENT_TIMESTAMP,
           rejected_by = NULL,
           rejected_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [adminId, deviceId]
    );

    // Log audit
    const clientIP = getClientIP(req);
    await logAudit({
      userId: req.user.username,
      userType: 'admin',
      action: AUDIT_ACTIONS.DEVICE_UNBLOCKED || 'device_unblocked',
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      details: {
        deviceId,
        employeeId: device.employee_id,
        deviceAlias: device.device_alias
      }
    });

    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UNBLOCK_DEVICE || 'UNBLOCK_DEVICE',
      moduleName: MODULE_NAMES.DEVICE,
      description: `Unblocked device for employee ${device.employee_id} - ${device.employee_name}`,
      newData: { deviceId, employeeId: device.employee_id, deviceAlias: device.device_alias },
      ipAddress: clientIP,
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Device unblocked successfully',
      device: result.rows[0]
    });

  } catch (error) {
    console.error('Unblock device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getAllTrustedDevices,
  getDeviceStats,
  approveDevice,
  rejectDevice,
  updateDeviceAlias,
  removeApproval,
  deleteDevice,
  blockDevice,
  unblockDevice
};
