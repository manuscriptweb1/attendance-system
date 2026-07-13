const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

// Enable WFH for employee
const enableWFH = async (req, res) => {
  try {
    const { employee_id } = req.body;
    const adminId = req.user.id;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    // Check if employee exists (using employee_id code, not database id)
    const employeeResult = await pool.query(
      'SELECT employee_id, name FROM employees WHERE employee_id = $1',
      [employee_id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const employeeName = employeeResult.rows[0].name;

    // Check if WFH permission already exists
    const existingPermission = await pool.query(
      'SELECT * FROM wfh_permissions WHERE employee_id = $1',
      [employee_id]
    );

    let result;
    if (existingPermission.rows.length > 0) {
      // Update existing permission
      result = await pool.query(
        `UPDATE wfh_permissions 
         SET is_enabled = true, enabled_by = $1, enabled_at = CURRENT_TIMESTAMP
         WHERE employee_id = $2
         RETURNING *`,
        [adminId, employee_id]
      );
    } else {
      // Insert new permission
      result = await pool.query(
        `INSERT INTO wfh_permissions (employee_id, is_enabled, enabled_by)
         VALUES ($1, true, $2)
         RETURNING *`,
        [employee_id, adminId]
      );
    }

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.GRANT_WFH_PERMISSION,
      moduleName: MODULE_NAMES.PERMISSIONS,
      description: `Granted WFH permission to ${employee_id} - ${employeeName}`,
      newData: { employee_id, employeeName, is_enabled: true },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'WFH access enabled successfully',
      permission: result.rows[0]
    });

  } catch (error) {
    console.error('Enable WFH error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Disable WFH for employee
const disableWFH = async (req, res) => {
  try {
    const { employee_id } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    // Get employee name
    const employeeResult = await pool.query(
      'SELECT name FROM employees WHERE employee_id = $1',
      [employee_id]
    );
    const employeeName = employeeResult.rows.length > 0 ? employeeResult.rows[0].name : '';

    const result = await pool.query(
      `UPDATE wfh_permissions 
       SET is_enabled = false
       WHERE employee_id = $1
       RETURNING *`,
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'WFH permission not found'
      });
    }

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.REVOKE_WFH_PERMISSION,
      moduleName: MODULE_NAMES.PERMISSIONS,
      description: `Revoked WFH permission from ${employee_id} - ${employeeName}`,
      newData: { employee_id, employeeName, is_enabled: false },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'WFH access disabled successfully',
      permission: result.rows[0]
    });

  } catch (error) {
    console.error('Disable WFH error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get WFH status for employee
const getWFHStatus = async (req, res) => {
  try {
    const employeeCode = req.user.employee_id; // Use employee code from JWT

    const result = await pool.query(
      'SELECT is_enabled FROM wfh_permissions WHERE employee_id = $1',
      [employeeCode]
    );

    const isEnabled = result.rows.length > 0 ? result.rows[0].is_enabled : false;

    res.json({
      success: true,
      wfh_enabled: isEnabled
    });

  } catch (error) {
    console.error('Get WFH status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  enableWFH,
  disableWFH,
  getWFHStatus
};
