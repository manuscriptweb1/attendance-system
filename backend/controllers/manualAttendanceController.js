const pool = require('../config/database');
const { normalizeAttendanceStatus } = require('../utils/statusHelper');
const { getClientIP } = require('../services/networkValidationService');
const { logAdminActivity } = require('../services/adminActivityService');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { validateDateInput, AppError } = require('../utils/dateValidation');
const { 
  getIndiaDateTime, getOfficeTimes, calculateCheckInStatus, calculateCheckOutStatus, calculateWorkedMinutes 
} = require('../utils/timeUtils');

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
        a.total_hours,
        a.checkin_status,
        a.checkout_status,
        a.late_minutes,
        a.early_minutes,
        a.total_minutes,
        a.absent_reason,
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

    if (status && status !== 'All') {
      if (status === 'No Record' || status === 'Not Mention') {
        query += ` AND (a.id IS NULL OR a.attendance_status = 'Not Mention')`;
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
    const settings = await getSettingsFromDB();
    const officeTimes = getOfficeTimes(settings);

    for (const record of records) {
      const { employee_id, attendance_date, login_time, logout_time, attendance_status, is_wfh, remarks } = record;

      // Validate attendance_date
      validateDateInput(attendance_date, { allowFuture: false });

      // Validate required times for Present/Late/Half Day
      if (['Present', 'Late', 'Half Day'].includes(attendance_status)) {
        if (!login_time) {
          const err = new Error(`Check-in time is required for Present, Late, or Half Day for ${employee_id}`);
          err.errorCode = 'MISSING_TIME';
          throw err;
        }
      }

      if (attendance_status === 'Absent' && !remarks) {
        const err = new Error(`Absent reason is required for ${employee_id}`);
        err.errorCode = 'MISSING_REASON';
        throw err;
      }

      // Validate times
      if (login_time && logout_time && new Date(login_time) > new Date(logout_time)) {
        const err = new Error(`Check-out time cannot be earlier than check-in time for ${employee_id}`);
        err.errorCode = 'INVALID_TIME';
        throw err;
      }

      const recordDate = new Date(attendance_date);
      if (recordDate.getDay() === 0) {
        throw new AppError('Manual attendance is not allowed on holidays or Sundays.', 400, 'HOLIDAY_BLOCKED');
      }
      
      const holidayCheck = await client.query(
        'SELECT * FROM holidays WHERE holiday_date = $1 AND is_enabled = true',
        [attendance_date]
      );
      if (holidayCheck.rows.length > 0) {
        throw new AppError('Manual attendance is not allowed on holidays or Sundays.', 400, 'HOLIDAY_BLOCKED');
      }

      // Check if attendance already exists
      const checkResult = await client.query(
        'SELECT id, attendance_status FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
        [employee_id, attendance_date]
      );

      let existingRecord = null;
      if (checkResult.rows.length > 0) {
        existingRecord = checkResult.rows[0];
        const normalizedStatus = normalizeAttendanceStatus(existingRecord.attendance_status);
        if (['Present', 'Late', 'Half Day', 'Absent'].includes(normalizedStatus)) {
          const err = new Error(`This employee with employee ID ${employee_id} already has attendance for this date.`);
          err.errorCode = 'DUPLICATE_ATTENDANCE';
          throw err;
        }
      }

      // Calculate working hours and statuses
      let workingHours = null;
      let totalMinutes = null;
      let totalHours = null;
      let checkinStatus = null;
      let checkoutStatus = null;
      let lateMinutes = 0;
      let earlyMinutes = 0;

      if (login_time) {
        const inStatusObj = calculateCheckInStatus(login_time, officeTimes.startTime, officeTimes.lateTime);
        checkinStatus = inStatusObj.checkin_status === 'Late' ? 'late' : 'on_time';
        lateMinutes = inStatusObj.late_minutes;
      }

      if (logout_time) {
        const outStatusObj = calculateCheckOutStatus(logout_time, officeTimes.endTime);
        checkoutStatus = outStatusObj.checkout_status === 'Late Check-Out' ? 'late' : (outStatusObj.checkout_status === 'Early Check-Out' ? 'early' : 'on_time');
        earlyMinutes = outStatusObj.early_minutes;
      }

      if (login_time && logout_time) {
        totalMinutes = calculateWorkedMinutes(login_time, logout_time, officeTimes.startTime);
        totalHours = parseFloat((totalMinutes / 60).toFixed(2));
        workingHours = totalHours;
      }

      if (attendance_status === 'Absent') {
        workingHours = 0;
        totalMinutes = 0;
        totalHours = 0;
        checkinStatus = null;
        checkoutStatus = null;
        lateMinutes = 0;
        earlyMinutes = 0;
      }

      // Final status resolution based on calculations
      let finalResolvedStatus = attendance_status;
      if (finalResolvedStatus !== 'Absent') {
        if (logout_time && totalHours > 0 && totalHours <= officeTimes.halfDayThreshold) {
          finalResolvedStatus = 'Half Day';
        } else if (checkinStatus === 'late') {
          finalResolvedStatus = 'Late';
        } else {
          finalResolvedStatus = 'Present';
        }
      }

      let newAttendance;
      if (existingRecord) {
        // Update existing 'Not Mention' record
        const updateResult = await client.query(
          `UPDATE attendance SET 
            login_time = $1, logout_time = $2, 
            total_working_hours = $3, attendance_status = $4, is_wfh = $5, 
            validation_method = $6, device_info = $7, updated_at = CURRENT_TIMESTAMP,
            total_minutes = $9, total_hours = $10, checkin_status = $11, checkout_status = $12, late_minutes = $13, early_minutes = $14,
            absent_reason = $15
           WHERE id = $8 RETURNING *`,
          [
            login_time || null, logout_time || null,
            workingHours, finalResolvedStatus, is_wfh || false,
            'Manual', remarks || reason, existingRecord.id,
            totalMinutes, totalHours, checkinStatus, checkoutStatus, lateMinutes, earlyMinutes,
            finalResolvedStatus === 'Absent' ? (remarks || reason) : null
          ]
        );
        newAttendance = updateResult.rows[0];
      } else {
        // Insert new attendance
        const insertResult = await client.query(
          `INSERT INTO attendance (
            employee_id, attendance_date, login_time, logout_time, 
            total_working_hours, attendance_status, is_wfh, 
            validation_method, device_info,
            total_minutes, total_hours, checkin_status, checkout_status, late_minutes, early_minutes, absent_reason
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
          [
            employee_id, attendance_date, login_time || null, logout_time || null,
            workingHours, finalResolvedStatus, is_wfh || false,
            'Manual', remarks || reason,
            totalMinutes, totalHours, checkinStatus, checkoutStatus, lateMinutes, earlyMinutes,
            finalResolvedStatus === 'Absent' ? (remarks || reason) : null
          ]
        );
        newAttendance = insertResult.rows[0];
      }

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
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ 
      success: false, 
      message: error.message || 'Server error',
      code: error.code || error.errorCode || 'UNKNOWN_ERROR'
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
    const { login_time, logout_time, attendance_status, is_wfh, reason, remarks } = req.body;
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

    // Holiday and Sunday validation
    const recordDate = new Date(attendance.attendance_date);
    if (recordDate.getDay() === 0) {
      const err = new Error(`Manual attendance is not allowed on holidays or Sundays.`);
      err.errorCode = 'SUNDAY_BLOCKED';
      throw err;
    }
    
    const holidayCheck = await client.query(
      'SELECT * FROM holidays WHERE holiday_date = $1 AND is_enabled = true',
      [attendance.attendance_date]
    );
    if (holidayCheck.rows.length > 0) {
      const err = new Error(`Manual attendance is not allowed on holidays or Sundays.`);
      err.errorCode = 'HOLIDAY_BLOCKED';
      throw err;
    }

    // Validate required times for Present/Late/Half Day
    if (['Present', 'Late', 'Half Day'].includes(attendance_status)) {
      if (!login_time) {
        return res.status(400).json({ success: false, message: 'Check-in time is required for Present, Late, or Half Day' });
      }
    }

    if (attendance_status === 'Absent' && !remarks) {
      return res.status(400).json({ success: false, message: 'Absent reason is required' });
    }

    // Validate attendance_date (if provided in body)
    if (req.body.attendance_date) {
      validateDateInput(req.body.attendance_date, { allowFuture: false });
    }

    // Validate times
    if (login_time && logout_time && new Date(login_time) > new Date(logout_time)) {
      const err = new Error('Check-out time cannot be earlier than check-in time');
      err.errorCode = 'INVALID_TIME';
      throw err;
    }

    // Calculate working hours
    let workingHours = null;
    let totalMinutes = null;
    let totalHours = null;
    
    let finalLoginTime = login_time !== undefined ? (login_time || null) : attendance.login_time;
    let finalLogoutTime = logout_time !== undefined ? (logout_time || null) : attendance.logout_time;
    let finalStatus = attendance_status || attendance.attendance_status;

    const settings = await getSettingsFromDB();
    const officeTimes = getOfficeTimes(settings);
    let checkinStatus = null;
    let checkoutStatus = null;
    let lateMinutes = 0;
    let earlyMinutes = 0;

    if (finalLoginTime) {
      const inStatusObj = calculateCheckInStatus(finalLoginTime, officeTimes.startTime, officeTimes.lateTime);
      checkinStatus = inStatusObj.checkin_status === 'Late' ? 'late' : 'on_time';
      lateMinutes = inStatusObj.late_minutes;
    }

    if (finalLogoutTime) {
      const outStatusObj = calculateCheckOutStatus(finalLogoutTime, officeTimes.endTime);
      checkoutStatus = outStatusObj.checkout_status === 'Late Check-Out' ? 'late' : (outStatusObj.checkout_status === 'Early Check-Out' ? 'early' : 'on_time');
      earlyMinutes = outStatusObj.early_minutes;
    }

    if (finalLoginTime && finalLogoutTime) {
      totalMinutes = calculateWorkedMinutes(finalLoginTime, finalLogoutTime, officeTimes.startTime);
      totalHours = parseFloat((totalMinutes / 60).toFixed(2));
      workingHours = totalHours;
    }
    
    if (finalStatus === 'Absent') {
      workingHours = 0;
      totalMinutes = 0;
      totalHours = 0;
      checkinStatus = null;
      checkoutStatus = null;
      lateMinutes = 0;
      earlyMinutes = 0;
    }

    // Final status resolution based on calculations
    let finalResolvedStatus = finalStatus;
    if (finalResolvedStatus !== 'Absent') {
      if (finalLogoutTime && totalHours > 0 && totalHours <= officeTimes.halfDayThreshold) {
        finalResolvedStatus = 'Half Day';
      } else if (checkinStatus === 'late') {
        finalResolvedStatus = 'Late';
      } else {
        finalResolvedStatus = 'Present';
      }
    }

    // Update attendance
    const updateResult = await client.query(
      `UPDATE attendance 
       SET login_time = $1,
           logout_time = $2,
           attendance_status = $3,
           is_wfh = COALESCE($4, is_wfh),
           total_working_hours = $5,
           total_hours = $7,
           total_minutes = $8,
           checkin_status = $9,
           checkout_status = $10,
           late_minutes = $11,
           early_minutes = $12,
           absent_reason = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [finalLoginTime, finalLogoutTime, finalResolvedStatus, is_wfh, workingHours, id, totalHours, totalMinutes, checkinStatus, checkoutStatus, lateMinutes, earlyMinutes, finalResolvedStatus === 'Absent' ? (remarks || reason) : null]
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
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ 
      success: false, 
      message: error.message || 'Server error',
      code: error.code || error.errorCode || 'UNKNOWN_ERROR'
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

// Single row Check-In (bypasses bulk validation)
const checkInRow = async (req, res) => {
  const client = await pool.connect();
  try {
    const { employee_id, attendance_date } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name || req.user.username;
    
    if (!employee_id || !attendance_date) {
      return res.status(400).json({ success: false, message: 'Missing employee_id or attendance_date' });
    }

    // Validate attendance_date
    validateDateInput(attendance_date, { allowFuture: false });

    const recordDate = new Date(attendance_date);
    if (recordDate.getDay() === 0) {
      return res.status(400).json({ success: false, message: 'Cannot check-in on Sundays' });
    }
    
    const holidayCheck = await pool.query('SELECT * FROM holidays WHERE holiday_date = $1 AND is_enabled = true', [attendance_date]);
    if (holidayCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot check-in on holidays' });
    }

    const checkResult = await pool.query('SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2', [employee_id, attendance_date]);
    const existingRecord = checkResult.rows[0];

    if (existingRecord && existingRecord.login_time) {
      return res.status(400).json({ success: false, message: 'Employee already checked in' });
    }

    const login_time = getIndiaDateTime();

    const settings = await getSettingsFromDB();
    const officeTimes = getOfficeTimes(settings);

    const inStatusObj = calculateCheckInStatus(login_time, officeTimes.startTime, officeTimes.lateTime);
    const checkinStatus = inStatusObj.checkin_status === 'Late' ? 'late' : 'on_time';
    const lateMinutes = inStatusObj.late_minutes;
    const attendanceStatus = inStatusObj.checkin_status === 'Late' ? 'Late' : 'Present';

    let newRecord;
    await client.query('BEGIN');

    if (existingRecord) {
      const updateResult = await client.query(
        `UPDATE attendance SET 
          login_time = $1, attendance_status = $2, checkin_status = $3, late_minutes = $4,
          validation_method = 'Manual', updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [login_time, attendanceStatus, checkinStatus, lateMinutes, existingRecord.id]
      );
      newRecord = updateResult.rows[0];
    } else {
      const insertResult = await client.query(
        `INSERT INTO attendance (
          employee_id, attendance_date, login_time, attendance_status, checkin_status, late_minutes, validation_method
        ) VALUES ($1, $2, $3, $4, $5, $6, 'Manual') RETURNING *`,
        [employee_id, attendance_date, login_time, attendanceStatus, checkinStatus, lateMinutes]
      );
      newRecord = insertResult.rows[0];
    }

    await client.query(
      `INSERT INTO manual_attendance_logs (attendance_id, employee_id, attendance_date, action, admin_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newRecord.id, employee_id, attendance_date, 'CHECKIN_ROW', adminId, 'Admin quick check-in']
    );

    await logAdminActivity({
      adminId, adminName, adminEmail: req.user.email, actionType: 'UPDATE', moduleName: 'Manual Attendance',
      description: `Quick check-in for employee ${employee_id}`, ipAddress: getClientIP(req), userAgent: req.headers['user-agent']
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Check-in successful', record: newRecord });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Row check-in error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

// Single row Check-Out (bypasses bulk validation)
const checkOutRow = async (req, res) => {
  const client = await pool.connect();
  try {
    const { employee_id, attendance_date } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name || req.user.username;
    
    if (!employee_id || !attendance_date) {
      return res.status(400).json({ success: false, message: 'Missing employee_id or attendance_date' });
    }

    // Validate attendance_date
    validateDateInput(attendance_date, { allowFuture: false });

    const checkResult = await pool.query('SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2', [employee_id, attendance_date]);
    const record = checkResult.rows[0];

    if (!record || !record.login_time) {
      return res.status(400).json({ success: false, message: 'Cannot check out without check-in' });
    }
    if (record.logout_time) {
      return res.status(400).json({ success: false, message: 'Already checked out' });
    }

    const logout_time = getIndiaDateTime();

    const settings = await getSettingsFromDB();
    const officeTimes = getOfficeTimes(settings);

    const outStatusObj = calculateCheckOutStatus(logout_time, officeTimes.endTime);
    const checkoutStatus = outStatusObj.checkout_status === 'Late Check-Out' ? 'late' : (outStatusObj.checkout_status === 'Early Check-Out' ? 'early' : 'on_time');
    const earlyMinutes = outStatusObj.early_minutes;

    const totalMinutes = calculateWorkedMinutes(record.login_time, logout_time, officeTimes.startTime);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
    const workingHours = totalHours;

    let attendanceStatus = record.attendance_status;
    if (attendanceStatus !== 'Absent' && attendanceStatus !== 'Half Day') {
      if (totalHours < officeTimes.halfDayThreshold) {
        attendanceStatus = 'Half Day';
      }
    }

    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE attendance SET 
        logout_time = $1, total_working_hours = $2, total_hours = $3, total_minutes = $4,
        checkout_status = $5, early_minutes = $6, attendance_status = $7,
        validation_method = 'Manual', updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [logout_time, workingHours, totalHours, totalMinutes, checkoutStatus, earlyMinutes, attendanceStatus, record.id]
    );

    await client.query(
      `INSERT INTO manual_attendance_logs (attendance_id, employee_id, attendance_date, action, admin_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [record.id, employee_id, attendance_date, 'CHECKOUT_ROW', adminId, 'Admin quick check-out']
    );

    await logAdminActivity({
      adminId, adminName, adminEmail: req.user.email, actionType: 'UPDATE', moduleName: 'Manual Attendance',
      description: `Quick check-out for employee ${employee_id}`, ipAddress: getClientIP(req), userAgent: req.headers['user-agent']
    });

    await client.query('COMMIT');
    res.json({ success: true, message: 'Check-out successful', record: updateResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Row check-out error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

/**
 * @desc    Clear manual attendance records for a date range
 * @route   DELETE /api/manual-attendance/clear-range
 * @access  Private/Admin
 */
const clearManualAttendanceRange = async (req, res) => {
  const client = await pool.connect();
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

    await client.query('BEGIN');

    // Delete manual logs
    const logsResult = await client.query(
      'DELETE FROM manual_attendance_logs WHERE attendance_date BETWEEN $1 AND $2 RETURNING id',
      [fromDate, toDate]
    );

    // Delete manual-created attendance rows
    const attendanceResult = await client.query(
      "DELETE FROM attendance WHERE validation_method = 'Manual' AND attendance_date BETWEEN $1 AND $2 RETURNING id",
      [fromDate, toDate]
    );

    await client.query('COMMIT');

    // Log the action
    await logAdminActivity({
      adminId,
      adminName,
      actionType: ADMIN_ACTION_TYPES.CLEAR_RANGE,
      moduleName: MODULE_NAMES.MANUAL_ATTENDANCE,
      description: `Cleared manual attendance records from ${fromDate} to ${toDate}. Count: logs(${logsResult.rowCount}), attendance(${attendanceResult.rowCount})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Manual records cleared successfully',
      deletedCount: attendanceResult.rowCount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Clear manual attendance range error:', error);
    res.status(500).json({ success: false, message: 'Server error while clearing manual records' });
  } finally {
    client.release();
  }
};

module.exports = {
  getEmployeesForManualAttendance,
  createManualAttendance,
  updateManualAttendance,
  deleteManualAttendance,
  checkInRow,
  checkOutRow,
  clearManualAttendanceRange
};

