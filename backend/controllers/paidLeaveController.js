const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { logAdminActivity, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');
const { validateDateInput } = require('../utils/dateValidation');

/**
 * Helper to safely extract client IP
 */
function getSafeClientIP(req) {
  try {
    return getClientIP(req);
  } catch (e) {
    return req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1';
  }
}

/**
 * Helper to calculate total hours between two HH:MM strings
 */
function calculateHoursBetween(startTimeStr, endTimeStr) {
  try {
    const [sH, sM] = startTimeStr.split(':').map(Number);
    const [eH, eM] = endTimeStr.split(':').map(Number);
    const startMins = sH * 60 + (sM || 0);
    const endMins = eH * 60 + (eM || 0);
    const diff = endMins - startMins;
    if (diff > 0) {
      return parseFloat((diff / 60).toFixed(2));
    }
  } catch (e) {
    // fallback
  }
  return 8.00;
}

/**
 * Get employees for Paid Leave on a specific date with dashboard stats
 */
const getPaidLeaveEmployees = async (req, res) => {
  try {
    const { date, department_id, search } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    validateDateInput(date, { allowFuture: false });

    // 1. Calculate Summary Stats for this Date
    const statsQuery = `
      SELECT
        COUNT(DISTINCT e.id) as total_active,
        COUNT(DISTINCT CASE WHEN pl.id IS NOT NULL THEN e.id END) as paid_leaves_count,
        COUNT(DISTINCT CASE WHEN a.attendance_status = 'Present' AND pl.id IS NULL THEN e.id END) as present_count,
        COUNT(DISTINCT CASE WHEN (a.id IS NULL OR a.attendance_status = 'Not Mention') AND pl.id IS NULL THEN e.id END) as pending_count
      FROM employees e
      LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.attendance_date = $1::DATE
      LEFT JOIN paid_leaves pl ON e.employee_id = pl.employee_id AND pl.leave_date = $1::DATE
      WHERE e.status = 'Active'
    `;
    const statsRes = await pool.query(statsQuery, [date]);
    const stats = statsRes.rows[0] || {
      total_active: 0,
      paid_leaves_count: 0,
      present_count: 0,
      pending_count: 0
    };

    // 2. Fetch Employees (Employees without attendance, or already marked as Paid Leave)
    let query = `
      SELECT 
        e.id as emp_db_id,
        e.employee_id,
        e.name,
        d.id as department_id,
        d.name as department_name,
        a.id as attendance_id,
        COALESCE(a.attendance_date, $1::DATE) as attendance_date,
        COALESCE(a.attendance_status, 'Not Mention') as attendance_status,
        a.login_time,
        a.logout_time,
        pl.id as paid_leave_id,
        pl.reason_category,
        pl.reason_notes,
        pl.office_start_time,
        pl.office_end_time,
        pl.total_hours,
        (CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END) as is_paid_leave,
        pl.created_at as paid_leave_created_at
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.attendance_date = $1::DATE
      LEFT JOIN paid_leaves pl ON e.employee_id = pl.employee_id AND pl.leave_date = $1::DATE
      WHERE e.status = 'Active' 
        AND (
          pl.id IS NOT NULL 
          OR a.id IS NULL 
          OR a.attendance_status = 'Not Mention'
        )
    `;

    const params = [date];
    let paramIndex = 2;

    if (department_id) {
      query += ` AND e.department_id = $${paramIndex}`;
      params.push(department_id);
      paramIndex++;
    }

    if (search) {
      query += ` AND (LOWER(e.name) LIKE LOWER($${paramIndex}) OR LOWER(e.employee_id) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY pl.id DESC NULLS LAST, e.employee_id ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      stats: {
        totalEmployees: parseInt(stats.total_active, 10) || 0,
        paidLeavesCount: parseInt(stats.paid_leaves_count, 10) || 0,
        presentCount: parseInt(stats.present_count, 10) || 0,
        pendingCount: parseInt(stats.pending_count, 10) || 0
      },
      employees: result.rows
    });
  } catch (error) {
    console.error('Get paid leave employees error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server error',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
};

/**
 * Mark Paid Leave for an employee on a specific date
 */
const markPaidLeave = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      employee_id,
      leave_date,
      reason_category,
      reason_notes
    } = req.body;

    const adminId = req.user?.id || null;
    const adminName = req.user?.username || req.user?.name || 'Admin';
    const adminEmail = req.user?.email || '';
    const ipAddress = getSafeClientIP(req);
    const browserInfo = req.headers['user-agent'] || '';

    if (!employee_id || !leave_date) {
      return res.status(400).json({ success: false, message: 'Employee ID and Date are required' });
    }

    if (!reason_category || !reason_category.trim()) {
      return res.status(400).json({ success: false, message: 'Reason category is required' });
    }

    validateDateInput(leave_date, { allowFuture: false });

    // Verify employee exists
    const empCheck = await pool.query(
      'SELECT id, employee_id, name, status FROM employees WHERE employee_id = $1',
      [employee_id]
    );

    if (empCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Employee with ID ${employee_id} not found.` });
    }

    const employee = empCheck.rows[0];

    // Fetch dynamic office start and end time from database settings
    const settings = await getSettingsFromDB();
    const officeStartTime = (settings.workingHours?.officeStartTime || '09:00').substring(0, 5);
    const officeEndTime = (settings.workingHours?.officeEndTime || '18:00').substring(0, 5);
    const totalWorkingHours = calculateHoursBetween(officeStartTime, officeEndTime);

    const loginTimestamp = `${leave_date} ${officeStartTime}:00`;
    const logoutTimestamp = `${leave_date} ${officeEndTime}:00`;
    const formattedReason = `Paid Leave: ${reason_category.trim()}${reason_notes ? ' - ' + reason_notes.trim() : ''}`;
    const locationNote = `Paid Leave (${reason_category.trim()})`;

    await client.query('BEGIN');

    // 1. Insert or Update `paid_leaves` table
    const numericAdminId = Number.isInteger(Number(adminId)) ? Number(adminId) : null;
    const paidLeaveResult = await client.query(
      `INSERT INTO paid_leaves (
         employee_id, leave_date, office_start_time, office_end_time,
         total_hours, reason_category, reason_notes, created_by,
         created_at, updated_at
       ) VALUES ($1, $2::DATE, $3::TIME, $4::TIME, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (employee_id, leave_date) DO UPDATE SET
         office_start_time = EXCLUDED.office_start_time,
         office_end_time = EXCLUDED.office_end_time,
         total_hours = EXCLUDED.total_hours,
         reason_category = EXCLUDED.reason_category,
         reason_notes = EXCLUDED.reason_notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        employee_id,
        leave_date,
        officeStartTime,
        officeEndTime,
        totalWorkingHours,
        reason_category.trim(),
        reason_notes ? reason_notes.trim() : null,
        numericAdminId
      ]
    );

    // 2. Synchronize with `attendance` table (Mark as Present with full working hours)
    const attendanceResult = await client.query(
      `INSERT INTO attendance (
         employee_id, attendance_date, login_time, logout_time,
         total_working_hours, attendance_status, validation_method,
         absent_reason, address_login, address_logout, is_auto_checkout,
         created_at, updated_at
       ) VALUES ($1, $2::DATE, $3::TIMESTAMP, $4::TIMESTAMP, $5, 'Present', 'Paid Leave', $6, $7, $7, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
         login_time = EXCLUDED.login_time,
         logout_time = EXCLUDED.logout_time,
         total_working_hours = EXCLUDED.total_working_hours,
         attendance_status = 'Present',
         validation_method = 'Paid Leave',
         absent_reason = EXCLUDED.absent_reason,
         address_login = EXCLUDED.address_login,
         address_logout = EXCLUDED.address_logout,
         is_auto_checkout = FALSE,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        employee_id,
        leave_date,
        loginTimestamp,
        logoutTimestamp,
        totalWorkingHours,
        formattedReason,
        locationNote
      ]
    );

    // 3. Log Admin Activity
    await logAdminActivity({
      adminId,
      adminName,
      adminEmail,
      actionType: 'PAID_LEAVE_MARKED',
      moduleName: MODULE_NAMES.MANUAL_ATTENDANCE || 'Manual Attendance',
      description: `Marked Paid Leave for ${employee.name} (${employee_id}) on ${leave_date}. Reason: ${reason_category.trim()} (Office Hours: ${officeStartTime} - ${officeEndTime})`,
      ipAddress,
      browserInfo,
      source: 'ADMIN_PANEL'
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Paid leave marked successfully for ${employee.name}.`,
      paidLeave: paidLeaveResult.rows[0],
      attendance: attendanceResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Mark paid leave error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to mark paid leave',
      code: error.code || 'UNKNOWN_ERROR'
    });
  } finally {
    client.release();
  }
};

/**
 * Clear/Delete Paid Leave for an employee
 */
const clearPaidLeave = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params; // paid_leave_id or 'emp'
    const { employee_id, date } = req.body;

    const adminId = req.user?.id || null;
    const adminName = req.user?.username || req.user?.name || 'Admin';
    const adminEmail = req.user?.email || '';
    const ipAddress = getSafeClientIP(req);
    const browserInfo = req.headers['user-agent'] || '';

    let targetEmpId = employee_id;
    let targetDate = date;

    // Find the paid leave record
    if (id && id !== 'emp' && !isNaN(parseInt(id, 10))) {
      const plCheck = await pool.query('SELECT * FROM paid_leaves WHERE id = $1', [id]);
      if (plCheck.rows.length > 0) {
        targetEmpId = plCheck.rows[0].employee_id;
        targetDate = plCheck.rows[0].leave_date;
      }
    }

    if (!targetEmpId || !targetDate) {
      return res.status(400).json({ success: false, message: 'Employee ID and Date are required to clear paid leave.' });
    }

    await client.query('BEGIN');

    // 1. Delete from `paid_leaves`
    await client.query(
      'DELETE FROM paid_leaves WHERE employee_id = $1 AND leave_date = $2::DATE',
      [targetEmpId, targetDate]
    );

    // 2. Reset the attendance record to Not Mention / Clean state
    await client.query(
      `UPDATE attendance SET
         attendance_status = 'Not Mention',
         login_time = NULL,
         logout_time = NULL,
         total_working_hours = NULL,
         validation_method = 'Manual',
         absent_reason = NULL,
         address_login = NULL,
         address_logout = NULL,
         updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = $1 AND attendance_date = $2::DATE`,
      [targetEmpId, targetDate]
    );

    // 3. Log Admin Activity
    await logAdminActivity({
      adminId,
      adminName,
      adminEmail,
      actionType: 'PAID_LEAVE_CLEARED',
      moduleName: MODULE_NAMES.MANUAL_ATTENDANCE || 'Manual Attendance',
      description: `Cleared Paid Leave for employee ${targetEmpId} on ${targetDate}`,
      ipAddress,
      browserInfo,
      source: 'ADMIN_PANEL'
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Paid leave cleared successfully.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Clear paid leave error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to clear paid leave',
      code: error.code || 'UNKNOWN_ERROR'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getPaidLeaveEmployees,
  markPaidLeave,
  clearPaidLeave
};
