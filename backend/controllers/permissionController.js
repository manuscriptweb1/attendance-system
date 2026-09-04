const pool = require('../config/database');
const { logAdminActivity, MODULE_NAMES } = require('../services/adminActivityService');

// Get all permissions (optionally filtered by month, year, employee_id)
const getPermissions = async (req, res) => {
  try {
    const { month, year, employee_id } = req.query;
    let query = `SELECT *, TO_CHAR(permission_date, 'YYYY-MM-DD') AS permission_date FROM employee_permissions WHERE 1=1`;
    const values = [];
    let paramCount = 1;

    if (month && year) {
      query += ` AND EXTRACT(MONTH FROM permission_date) = $${paramCount} AND EXTRACT(YEAR FROM permission_date) = $${paramCount + 1}`;
      values.push(month, year);
      paramCount += 2;
    }

    if (employee_id) {
      query += ` AND employee_id = $${paramCount}`;
      values.push(employee_id);
      paramCount++;
    }

    query += ' ORDER BY employee_permissions.permission_date DESC, from_time DESC';

    const result = await pool.query(query, values);
    res.json({ success: true, permissions: result.rows });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getPermissionSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year required' });
    }

    // 1. Total Permission Records
    const recordsResult = await pool.query(
      `SELECT COUNT(*) as total_records, COUNT(DISTINCT employee_id) as employees_with_permission, COALESCE(SUM(duration_minutes), 0) as total_minutes
       FROM employee_permissions
       WHERE EXTRACT(MONTH FROM permission_date) = $1 AND EXTRACT(YEAR FROM permission_date) = $2`,
      [month, year]
    );

    // 2. Today Permission Count
    const todayResult = await pool.query(
      `SELECT COUNT(*) as today_count FROM employee_permissions WHERE permission_date = CURRENT_DATE`
    );

    const summary = {
      totalRecords: parseInt(recordsResult.rows[0].total_records),
      employeesWithPermission: parseInt(recordsResult.rows[0].employees_with_permission),
      totalPermissionMinutes: parseInt(recordsResult.rows[0].total_minutes),
      todayCount: parseInt(todayResult.rows[0].today_count)
    };

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Get permission summary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createPermission = async (req, res) => {
  try {
    const { employee_id, employee_name, department_name, permission_date, from_time, to_time, reason } = req.body;

    if (!employee_id || !permission_date || !from_time || !to_time || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Calculate duration in minutes on backend
    const [fromHours, fromMinutes] = from_time.split(':').map(Number);
    const [toHours, toMinutes] = to_time.split(':').map(Number);
    
    const fromTotalMinutes = fromHours * 60 + fromMinutes;
    const toTotalMinutes = toHours * 60 + toMinutes;
    
    const duration_minutes = toTotalMinutes - fromTotalMinutes;

    if (duration_minutes <= 0) {
      return res.status(400).json({ success: false, message: 'To time must be greater than from time' });
    }

    // Insert into DB
    const numericAdminId = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;
    const result = await pool.query(
      `INSERT INTO employee_permissions 
       (employee_id, employee_name, department_name, permission_date, from_time, to_time, duration_minutes, reason, created_by_admin_id, created_by_admin_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [employee_id, employee_name, department_name, permission_date, from_time, to_time, duration_minutes, reason, numericAdminId, req.user?.username || 'Admin']
    );

    const formatDuration = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
    };

    const perm = result.rows[0];
    const logDesc = `Created permission for ${employee_name} (${employee_id}) on ${permission_date} from ${from_time} to ${to_time}. Reason: ${reason}. Duration: ${formatDuration(duration_minutes)}`;

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: 'permission_created',
      moduleName: MODULE_NAMES.PERMISSIONS || 'Permissions',
      description: logDesc,
      newData: perm,
      ipAddress: req.ip
    });

    res.json({ success: true, permission: perm });
  } catch (error) {
    console.error('Create permission error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ success: false, message: 'Permission record already exists for this exact time' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { permission_date, from_time, to_time, reason } = req.body;

    const oldRecordRes = await pool.query('SELECT * FROM employee_permissions WHERE id = $1', [id]);
    if (oldRecordRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    
    const oldData = oldRecordRes.rows[0];

    // Calculate duration in minutes on backend
    const [fromHours, fromMinutes] = from_time.split(':').map(Number);
    const [toHours, toMinutes] = to_time.split(':').map(Number);
    
    const fromTotalMinutes = fromHours * 60 + fromMinutes;
    const toTotalMinutes = toHours * 60 + toMinutes;
    
    const duration_minutes = toTotalMinutes - fromTotalMinutes;

    if (duration_minutes <= 0) {
      return res.status(400).json({ success: false, message: 'To time must be greater than from time' });
    }

    const result = await pool.query(
      `UPDATE employee_permissions 
       SET permission_date = $1, from_time = $2, to_time = $3, duration_minutes = $4, reason = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [permission_date, from_time, to_time, duration_minutes, reason, id]
    );

    const newData = result.rows[0];
    const logDesc = `Updated permission for ${oldData.employee_name} (${oldData.employee_id}) on ${permission_date}`;

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: 'permission_updated',
      moduleName: MODULE_NAMES.PERMISSIONS || 'Permissions',
      description: logDesc,
      oldData,
      newData,
      ipAddress: req.ip
    });

    res.json({ success: true, permission: newData });
  } catch (error) {
    console.error('Update permission error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ success: false, message: 'Permission record already exists for this exact time' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const oldRecordRes = await pool.query('SELECT * FROM employee_permissions WHERE id = $1', [id]);
    if (oldRecordRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    
    const oldData = oldRecordRes.rows[0];

    await pool.query('DELETE FROM employee_permissions WHERE id = $1', [id]);

    const oldDateStr = new Date(oldData.permission_date).toISOString().split('T')[0];
    const logDesc = `Deleted permission for ${oldData.employee_name} (${oldData.employee_id}) on ${oldDateStr} from ${oldData.from_time} to ${oldData.to_time}`;

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: 'permission_deleted',
      moduleName: MODULE_NAMES.PERMISSIONS || 'Permissions',
      description: logDesc,
      oldData,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete permission error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const clearPermissionRange = async (req, res) => {
  try {
    const { from_date, to_date, confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Please type DELETE to confirm', code: 'INVALID_CONFIRMATION' });
    }

    if (!from_date || !to_date) {
      return res.status(400).json({ success: false, message: 'From date and To date are required', code: 'DATE_REQUIRED' });
    }

    if (new Date(to_date) < new Date(from_date)) {
      return res.status(400).json({ success: false, message: 'To Date cannot be before From Date', code: 'INVALID_DATE_RANGE' });
    }

    const result = await pool.query(
      `DELETE FROM employee_permissions 
       WHERE permission_date >= $1 AND permission_date <= $2 
       RETURNING id`,
      [from_date, to_date]
    );

    const deletedCount = result.rowCount;

    if (deletedCount > 0) {
      const logDesc = `Cleared permission records from ${from_date} to ${to_date}. Deleted count: ${deletedCount}`;
      await logAdminActivity({
        adminId: req.user.id,
        adminName: req.user.username,
        adminEmail: req.user.email || '',
        actionType: 'CLEAR_PERMISSION_RECORDS',
        moduleName: MODULE_NAMES.PERMISSIONS || 'Permissions',
        description: logDesc,
        ipAddress: req.ip
      });
    }

    res.json({
      success: true,
      message: deletedCount > 0 
        ? 'Permission records cleared successfully' 
        : 'No permission records found for selected date range',
      deletedCount
    });

  } catch (error) {
    console.error('Clear permission range error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getPermissions,
  getPermissionSummary,
  createPermission,
  updatePermission,
  deletePermission,
  clearPermissionRange
};
