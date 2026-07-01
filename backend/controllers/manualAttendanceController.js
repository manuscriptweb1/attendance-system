const pool = require('../config/database');
const { getClientIP } = require('../services/networkValidationService');
const { logAdminActivity } = require('../services/adminActivityService');

// Get employees with their attendance for a specific date
const getEmployeesForManualAttendance = async (req, res) => {
  try {
    const { date, department_id, search, status } = req.query;
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
        a.attendance_status,
        a.login_time,
        a.logout_time,
        a.total_working_hours,
        a.validation_method
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.attendance_date = $1
      WHERE e.status = 'Active'
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

    if (status) {
      if (status === 'No Record') {
        query += ` AND a.id IS NULL`;
      } else {
        query += ` AND a.attendance_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
    }

    query += ` ORDER BY e.employee_id ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      employees: result.rows
    });
  } catch (error) {
    console.error('Get employees for manual attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create bulk/single manual attendance
const createManualAttendance = async (req, res) => {
  const client = await pool.connect();
  try {
    const { records, reason } = req.body;
    // records: [{ employee_id, attendance_date, login_time, logout_time, attendance_status, is_wfh, remarks }]
    const adminId = req.user.id;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided' });
    }
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Manual attendance reason is required' });
    }

    await client.query('BEGIN');
    const createdRecords = [];

    for (const record of records) {
      const { employee_id, attendance_date, login_time, logout_time, attendance_status, is_wfh, remarks } = record;

      // Validate attendance_date is present and valid
      if (!attendance_date || attendance_date.trim() === '') {
        const err = new Error('Attendance date is missing. Please select a valid date before creating records.');
        err.errorCode = 'MISSING_DATE';
        throw err;
      }
      // Validate it parses correctly
      const parsedDate = new Date(attendance_date);
      if (isNaN(parsedDate.getTime())) {
        const err = new Error(`Invalid attendance date "${attendance_date}". Please select a valid date.`);
        err.errorCode = 'INVALID_DATE';
        throw err;
      }

      // Validate times
      if (login_time && logout_time && new Date(login_time) > new Date(logout_time)) {
        const err = new Error(`Check-in time cannot be after check-out time for ${employee_id}`);
        err.errorCode = 'INVALID_TIME';
        throw err;
      }

      // Check if attendance already exists
      const checkResult = await client.query(
        'SELECT id FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
        [employee_id, attendance_date]
      );

      if (checkResult.rows.length > 0) {
        const err = new Error(`Attendance already exists for employee ${employee_id} on ${attendance_date}`);
        err.errorCode = 'DUPLICATE_ATTENDANCE';
        throw err;
      }

      // Calculate working hours if both times provided
      let workingHours = null;
      if (login_time && logout_time) {
        workingHours = (new Date(logout_time) - new Date(login_time)) / (1000 * 60 * 60);
      }

      // Insert attendance
      const insertResult = await client.query(
        `INSERT INTO attendance (
          employee_id, attendance_date, login_time, logout_time, 
          total_working_hours, attendance_status, is_wfh, 
          validation_method, device_info
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          employee_id, attendance_date, login_time || null, logout_time || null,
          workingHours, attendance_status, is_wfh || false,
          'Manual', remarks || reason
        ]
      );

      const newAttendance = insertResult.rows[0];

      // Log manual action
      await client.query(
        `INSERT INTO manual_attendance_logs (
          attendance_id, employee_id, attendance_date, action, admin_id, reason
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [newAttendance.id, employee_id, attendance_date, 'CREATED', adminId, reason]
      );

      createdRecords.push(newAttendance);
    }

    await client.query('COMMIT');
    
    // Log Admin Activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.name || req.user.username,
      adminEmail: req.user.email,
      actionType: 'CREATE',
      moduleName: 'Manual Attendance',
      description: `Created manual attendance for ${createdRecords.length} employee(s). Reason: ${reason}`,
      newData: { count: createdRecords.length, reason },
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({ success: true, message: `Successfully created ${createdRecords.length} attendance records` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create manual attendance error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Server error',
      errorCode: error.errorCode || 'UNKNOWN_ERROR'
    });
  } finally {
    client.release();
  }
};

// Update manual attendance
const updateManualAttendance = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { login_time, logout_time, attendance_status, is_wfh, reason } = req.body;
    const adminId = req.user.id;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Reason for update is required' });
    }

    await client.query('BEGIN');

    // Check if attendance exists and is manual
    const checkResult = await client.query(
      'SELECT * FROM attendance WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Attendance record not found');
    }

    const attendance = checkResult.rows[0];

    if (attendance.validation_method !== 'Manual') {
      throw new Error('Only manually created attendance records can be edited from this module');
    }

    // Validate times
    if (login_time && logout_time && new Date(login_time) > new Date(logout_time)) {
      const err = new Error('Check-in time cannot be after check-out time');
      err.errorCode = 'INVALID_TIME';
      throw err;
    }

    // Calculate working hours
    let workingHours = null;
    let totalMinutes = null;
    let totalHours = null;
    
    let finalLoginTime = login_time || attendance.login_time;
    let finalLogoutTime = logout_time || attendance.logout_time;

    if (finalLoginTime && finalLogoutTime) {
      const ms = new Date(finalLogoutTime) - new Date(finalLoginTime);
      workingHours = ms / (1000 * 60 * 60);
      totalMinutes = Math.floor(ms / (1000 * 60));
      totalHours = parseFloat((totalMinutes / 60).toFixed(2));
    } else {
      workingHours = attendance.total_working_hours;
      totalMinutes = attendance.total_minutes || 0;
      totalHours = attendance.total_hours || 0;
    }

    // Update attendance
    const updateResult = await client.query(
      `UPDATE attendance 
       SET login_time = COALESCE($1, login_time),
           logout_time = COALESCE($2, logout_time),
           attendance_status = COALESCE($3, attendance_status),
           is_wfh = COALESCE($4, is_wfh),
           total_working_hours = $5,
           total_hours = $7,
           total_minutes = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [login_time || null, logout_time || null, attendance_status, is_wfh, workingHours, id, totalHours, totalMinutes]
    );

    // Log manual action
    await client.query(
      `INSERT INTO manual_attendance_logs (
        attendance_id, employee_id, attendance_date, action, admin_id, reason
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, attendance.employee_id, attendance.attendance_date, 'UPDATED', adminId, reason]
    );

    await client.query('COMMIT');
    
    // Log Admin Activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.name || req.user.username,
      adminEmail: req.user.email,
      actionType: 'UPDATE',
      moduleName: 'Manual Attendance',
      description: `Updated manual attendance for employee ${attendance.employee_id}. Reason: ${reason}`,
      oldData: { 
        login_time: attendance.login_time, 
        logout_time: attendance.logout_time, 
        attendance_status: attendance.attendance_status 
      },
      newData: { 
        login_time, 
        logout_time, 
        attendance_status 
      },
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Attendance record updated successfully', attendance: updateResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update manual attendance error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Server error',
      errorCode: error.errorCode || 'UNKNOWN_ERROR'
    });
  } finally {
    client.release();
  }
};

// Delete a manual attendance record (only Manual records are deletable)
const deleteManualAttendance = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Fetch the record first to verify it exists and is Manual
    const fetchResult = await client.query(
      'SELECT * FROM attendance WHERE id = $1',
      [id]
    );

    if (fetchResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    const attendance = fetchResult.rows[0];

    if (attendance.validation_method !== 'Manual') {
      return res.status(403).json({ success: false, message: 'Only manually created attendance records can be deleted.' });
    }

    await client.query('BEGIN');

    // Log before deletion
    await client.query(
      `INSERT INTO manual_attendance_logs (attendance_id, employee_id, attendance_date, action, admin_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, attendance.employee_id, attendance.attendance_date, 'DELETED', adminId, 'Admin deleted manual record']
    );

    // Delete the record
    await client.query('DELETE FROM attendance WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Log Admin Activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.name || req.user.username,
      adminEmail: req.user.email,
      actionType: 'DELETE',
      moduleName: 'Manual Attendance',
      description: `Deleted manual attendance for employee ${attendance.employee_id} on ${attendance.attendance_date}.`,
      oldData: attendance,
      newData: null,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Manual attendance record deleted successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete manual attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  getEmployeesForManualAttendance,
  createManualAttendance,
  updateManualAttendance,
  deleteManualAttendance
};
