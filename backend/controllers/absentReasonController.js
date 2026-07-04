const pool = require('../config/database');
const { normalizeAttendanceStatus } = require('../utils/statusHelper');
const { logAdminActivity } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');
const { validateDateInput, AppError } = require('../utils/dateValidation');

// Get absent employees for a specific date
const getAbsentEmployees = async (req, res) => {
  try {
    const { date, department_id, search } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    let query = `
      SELECT 
        e.id as emp_db_id,
        e.employee_id,
        e.name,
        d.name as department_name,
        a.id as attendance_id,
        a.attendance_date,
        COALESCE(a.attendance_status, 'Not Mention') as attendance_status,
        a.absent_reason,
        a.updated_at
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.attendance_date = $1
      WHERE e.status = 'Active' AND (a.attendance_status = 'Not Mention' OR a.id IS NULL)
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

    query += ` ORDER BY e.employee_id ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      absentEmployees: result.rows
    });
  } catch (error) {
    console.error('Get absent employees error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ 
      success: false, 
      message: error.message || 'Server error',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
};

// Add or update absent reason
const updateAbsentReason = async (req, res) => {
  try {
    const { attendance_id } = req.params;
    const { reason, employee_id, date } = req.body;
    
    if (date) {
      validateDateInput(date, { allowFuture: false, isAbsentReason: true });
      
      const recordDate = new Date(date);
      if (recordDate.getDay() === 0) {
        throw new AppError('Absent reason is not allowed on holidays or Sundays.', 400, 'HOLIDAY_BLOCKED');
      }
      
      const holidayCheck = await pool.query(
        'SELECT * FROM holidays WHERE holiday_date = $1 AND is_enabled = true',
        [date]
      );
      if (holidayCheck.rows.length > 0) {
        throw new AppError('Absent reason is not allowed on holidays or Sundays.', 400, 'HOLIDAY_BLOCKED');
      }
    }
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Absent reason is required' });
    }

    let oldReason = null;
    let attendanceRecord = null;

    if (attendance_id === 'new') {
      if (!employee_id || !date) {
        return res.status(400).json({ success: false, message: 'Employee ID and Date are required for new record' });
      }

      // Check if attendance already exists just in case
      const existing = await pool.query(
        'SELECT id, attendance_status FROM attendance WHERE employee_id = $1 AND attendance_date = $2::DATE',
        [employee_id, date]
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].attendance_status !== 'Not Mention') {
          return res.status(400).json({ success: false, message: 'Employee already has a valid attendance record for this date.' });
        }
        // If it's Not Mention, we can update it
        const updateResult = await pool.query(
          `UPDATE attendance 
           SET attendance_status = 'Absent', absent_reason = $1, validation_method = 'Manual', updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 RETURNING *`,
          [reason, existing.rows[0].id]
        );
        attendanceRecord = updateResult.rows[0];
      } else {
        // Insert new Absent record with Upsert fallback
        const insertResult = await pool.query(
          `INSERT INTO attendance (
             employee_id, attendance_date, attendance_status, 
             absent_reason, validation_method, created_at, updated_at
           ) VALUES ($1, $2, 'Absent', $3, 'Manual', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
             attendance_status = 'Absent',
             absent_reason = EXCLUDED.absent_reason,
             validation_method = 'Manual',
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [employee_id, date, reason]
        );
        attendanceRecord = insertResult.rows[0];
      }
    } else {
      // Verify attendance is Absent
      const checkResult = await pool.query(
        'SELECT attendance_status, absent_reason FROM attendance WHERE id = $1',
        [attendance_id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Attendance record not found' });
      }

      if (checkResult.rows[0].attendance_status !== 'Not Mention' && checkResult.rows[0].attendance_status !== 'Absent') {
        return res.status(400).json({ 
          success: false, 
          message: 'Absent reasons can only be added to employees whose attendance status is Not Mention or Absent.' 
        });
      }

      oldReason = checkResult.rows[0].absent_reason;

      // Update reason
      const updateResult = await pool.query(
        `UPDATE attendance 
         SET absent_reason = $1, attendance_status = 'Absent', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [reason, attendance_id]
      );
      attendanceRecord = updateResult.rows[0];
    }

    // Log Admin Activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.name || req.user.username,
      adminEmail: req.user.email,
      actionType: 'UPDATE',
      moduleName: 'Absent Reason',
      description: `Updated absent reason for attendance record ${attendance_id}. Reason: ${reason}`,
      oldData: { absent_reason: oldReason },
      newData: { absent_reason: reason },
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    });

    res.json({ 
      success: true, 
      message: 'Absent reason saved successfully',
      attendance: attendanceRecord
    });
  } catch (error) {
    console.error('Update absent reason error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ 
      success: false, 
      message: error.message || 'Server error',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
};

// Clear (remove) an absent reason from an attendance record
const clearAbsentReason = async (req, res) => {
  try {
    const { attendance_id } = req.params;

    const checkResult = await pool.query(
      'SELECT id, absent_reason, attendance_status FROM attendance WHERE id = $1',
      [attendance_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    const oldReason = checkResult.rows[0].absent_reason;

    await pool.query(
      "UPDATE attendance SET absent_reason = NULL, attendance_status = 'Not Mention', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [attendance_id]
    );

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.name || req.user.username,
      adminEmail: req.user.email,
      actionType: 'UPDATE',
      moduleName: 'Absent Reason',
      description: `Cleared absent reason for attendance record ${attendance_id}. Previous reason: ${oldReason}`,
      oldData: { absent_reason: oldReason },
      newData: { absent_reason: null },
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Absent reason cleared successfully.' });
  } catch (error) {
    console.error('Clear absent reason error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ 
      success: false, 
      message: error.message || 'Server error',
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
};

/**
 * @desc    Clear absent reasons for a date range
 * @route   PUT /api/absent-reasons/clear-range
 * @access  Private/Admin
 */
const clearAbsentReasonRange = async (req, res) => {
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
      `UPDATE attendance 
       SET absent_reason = NULL, attendance_status = 'Not Mention', updated_at = CURRENT_TIMESTAMP 
       WHERE attendance_date BETWEEN $1 AND $2 AND absent_reason IS NOT NULL 
       RETURNING id`,
      [fromDate, toDate]
    );

    // Log the action
    await logAdminActivity({
      adminId,
      adminName,
      actionType: ADMIN_ACTION_TYPES.CLEAR_RANGE,
      moduleName: MODULE_NAMES.ABSENT_REASONS,
      description: `Cleared absent reasons from ${fromDate} to ${toDate}. Count: ${result.rowCount}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Absent reasons cleared successfully',
      deletedCount: result.rowCount
    });

  } catch (error) {
    console.error('Clear absent reason range error:', error);
    res.status(500).json({ success: false, message: 'Server error while clearing records' });
  }
};

module.exports = {
  getAbsentEmployees,
  updateAbsentReason,
  clearAbsentReason,
  clearAbsentReasonRange
};

