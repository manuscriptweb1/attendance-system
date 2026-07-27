const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { validateDateInput } = require('../utils/dateValidation');
const { 
  getIndiaDateTime, 
  getOfficeTimes, 
  calculateCheckInStatus, 
  calculateCheckOutStatus, 
  calculateWorkedMinutes 
} = require('../utils/timeUtils');
const { logAdminActivity } = require('./adminActivityService');

/**
 * Checks if attendance/absent/checkout action is blocked due to Sunday or Holiday
 * Returns detailed blocked reason object with customized action messages
 */
const getAttendanceBlockedReason = async (dateStr, actionName = 'mark attendance') => {
  if (!dateStr) return { blocked: false };

  const recordDate = new Date(dateStr);
  if (recordDate.getDay() === 0) {
    let msg = `Cannot ${actionName} today because today is Sunday. Sundays are automatically treated as holidays.`;
    if (actionName === 'check-out all') {
      msg = `Check-out all is not allowed today because today is Sunday. Sundays are automatically treated as holidays.`;
    }
    return {
      blocked: true,
      type: 'SUNDAY',
      reason: 'Sunday',
      message: msg
    };
  }

  const holidayCheck = await pool.query(
    `SELECT id, holiday_title, holiday_type FROM holidays WHERE holiday_date = $1 AND is_enabled = true`,
    [dateStr]
  );

  if (holidayCheck.rows.length > 0) {
    const h = holidayCheck.rows[0];
    const hTitle = h.holiday_title || 'Holiday';
    const hType = (h.holiday_type || '').trim();

    let categoryStr = 'a holiday';
    if (hType === 'Office Holiday' || hType.toLowerCase().includes('office')) {
      categoryStr = `an Office Holiday: ${hTitle}`;
    } else if (hType === 'Government Holiday' || hType.toLowerCase().includes('gov')) {
      categoryStr = `a Government Holiday: ${hTitle}`;
    } else {
      categoryStr = `a holiday: ${hTitle}`;
    }

    let msg = `Cannot ${actionName} today because today is ${categoryStr}.`;
    if (actionName === 'check-out all') {
      msg = `Check-out all is not allowed today because today is ${categoryStr}.`;
    }

    return {
      blocked: true,
      type: hType || 'HOLIDAY',
      holidayName: hTitle,
      message: msg
    };
  }

  return { blocked: false };
};

/**
 * Perform single-employee quick check-in using current India time & office settings
 */
const quickCheckInEmployee = async ({
  employeeId,
  attendanceDate,
  adminId,
  adminName = 'System Admin',
  adminEmail = '',
  ipAddress = '127.0.0.1',
  userAgent = 'Server',
  reasonSource = 'Manual quick check-in'
}) => {
  const targetDate = attendanceDate || getIndiaDateTime().split('T')[0];

  validateDateInput(targetDate, { allowFuture: false });

  const blockedCheck = await getAttendanceBlockedReason(targetDate, 'mark check-in');
  if (blockedCheck.blocked) {
    throw new Error(blockedCheck.message);
  }

  const empCheck = await pool.query(
    'SELECT employee_id, name FROM employees WHERE employee_id = $1 OR id::text = $1',
    [employeeId]
  );
  if (empCheck.rows.length === 0) {
    throw new Error(`Employee "${employeeId}" not found.`);
  }

  const realEmpCode = empCheck.rows[0].employee_id;
  const empName = empCheck.rows[0].name;

  const checkResult = await pool.query(
    'SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
    [realEmpCode, targetDate]
  );
  const existingRecord = checkResult.rows[0];

  if (existingRecord && existingRecord.login_time) {
    throw new Error(`Employee ${realEmpCode} - ${empName} is already checked in today.`);
  }

  const loginTime = getIndiaDateTime();
  const settings = await getSettingsFromDB();
  const officeTimes = getOfficeTimes(settings);

  const inStatusObj = calculateCheckInStatus(loginTime, officeTimes.startTime, officeTimes.lateTime);
  const checkinStatus = inStatusObj.checkin_status === 'Late' ? 'late' : 'on_time';
  const lateMinutes = Number(inStatusObj.late_minutes || 0);
  const attendanceStatus = inStatusObj.checkin_status === 'Late' ? 'Late' : 'Present';

  const client = await pool.connect();
  let newRecord;
  try {
    await client.query('BEGIN');

    if (existingRecord) {
      const updateResult = await client.query(
        `UPDATE attendance SET 
          login_time = $1, attendance_status = $2, checkin_status = $3, late_minutes = $4,
          validation_method = 'Manual', absent_reason = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [loginTime, attendanceStatus, checkinStatus, lateMinutes, existingRecord.id]
      );
      newRecord = updateResult.rows[0];
    } else {
      const insertResult = await client.query(
        `INSERT INTO attendance (
          employee_id, attendance_date, login_time, attendance_status, checkin_status, late_minutes, validation_method
        ) VALUES ($1, $2, $3, $4, $5, $6, 'Manual') RETURNING *`,
        [realEmpCode, targetDate, loginTime, attendanceStatus, checkinStatus, lateMinutes]
      );
      newRecord = insertResult.rows[0];
    }

    await client.query(
      `INSERT INTO manual_attendance_logs (attendance_id, employee_id, attendance_date, action, admin_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newRecord.id, realEmpCode, targetDate, 'CHECKIN_ROW', adminId, reasonSource]
    );

    await logAdminActivity({
      adminId,
      adminName,
      adminEmail,
      actionType: 'Check-In',
      moduleName: 'Manual Attendance',
      description: `Quick check-in for employee ${realEmpCode} (${empName})`,
      ipAddress,
      userAgent
    });

    await client.query('COMMIT');

    return {
      success: true,
      employeeCode: realEmpCode,
      employeeName: empName,
      loginTime,
      attendanceStatus,
      checkinStatus,
      lateMinutes,
      late_minutes: lateMinutes,
      record: newRecord
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Perform single-employee quick check-out using current India time & office settings
 */
const quickCheckOutEmployee = async ({
  employeeId,
  attendanceDate,
  adminId,
  adminName = 'System Admin',
  adminEmail = '',
  ipAddress = '127.0.0.1',
  userAgent = 'Server',
  reasonSource = 'Manual quick check-out'
}) => {
  const targetDate = attendanceDate || getIndiaDateTime().split('T')[0];

  validateDateInput(targetDate, { allowFuture: false });

  const empCheck = await pool.query(
    'SELECT employee_id, name FROM employees WHERE employee_id = $1 OR id::text = $1',
    [employeeId]
  );
  if (empCheck.rows.length === 0) {
    throw new Error(`Employee "${employeeId}" not found.`);
  }

  const realEmpCode = empCheck.rows[0].employee_id;
  const empName = empCheck.rows[0].name;

  const checkResult = await pool.query(
    'SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
    [realEmpCode, targetDate]
  );
  const record = checkResult.rows[0];

  if (!record || !record.login_time) {
    throw new Error(`Cannot check out ${realEmpCode} - ${empName} because check-in is not marked today.`);
  }
  if (record.logout_time) {
    throw new Error(`Attendance is already completed for ${realEmpCode} - ${empName} today.`);
  }

  const logoutTime = getIndiaDateTime();
  const settings = await getSettingsFromDB();
  const officeTimes = getOfficeTimes(settings);

  const outStatusObj = calculateCheckOutStatus(logoutTime, officeTimes.endTime);
  const checkoutStatus = outStatusObj.checkout_status === 'Late Check-Out' ? 'late' : (outStatusObj.checkout_status === 'Early Check-Out' ? 'early' : 'on_time');
  const earlyMinutes = outStatusObj.early_minutes;

  const totalMinutes = calculateWorkedMinutes(record.login_time, logoutTime, officeTimes.startTime);
  const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
  const workingHours = totalHours;

  let attendanceStatus = record.attendance_status;
  if (attendanceStatus !== 'Absent' && attendanceStatus !== 'Half Day') {
    if (totalHours < officeTimes.halfDayThreshold) {
      attendanceStatus = 'Half Day';
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE attendance SET 
        logout_time = $1, total_working_hours = $2, total_hours = $3, total_minutes = $4,
        checkout_status = $5, early_minutes = $6, attendance_status = $7,
        validation_method = 'Manual', updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [logoutTime, workingHours, totalHours, totalMinutes, checkoutStatus, earlyMinutes, attendanceStatus, record.id]
    );

    await client.query(
      `INSERT INTO manual_attendance_logs (attendance_id, employee_id, attendance_date, action, admin_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [record.id, realEmpCode, targetDate, 'CHECKOUT_ROW', adminId, reasonSource]
    );

    await logAdminActivity({
      adminId,
      adminName,
      adminEmail,
      actionType: 'Check-Out',
      moduleName: 'Manual Attendance',
      description: `Quick check-out for employee ${realEmpCode} (${empName})`,
      ipAddress,
      userAgent
    });

    await client.query('COMMIT');
    return {
      success: true,
      employeeCode: realEmpCode,
      employeeName: empName,
      logoutTime,
      totalMinutes,
      totalHours,
      workingHours,
      attendanceStatus,
      checkoutStatus,
      earlyMinutes,
      record: updateResult.rows[0]
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Perform check-out for ALL employees currently checked in without check-out today
 */
const checkOutAllEmployees = async ({
  adminId,
  adminName = 'System Admin',
  adminEmail = '',
  ipAddress = '127.0.0.1',
  userAgent = 'Server'
}) => {
  const targetDate = getIndiaDateTime().split('T')[0];

  const blockedCheck = await getAttendanceBlockedReason(targetDate, 'check-out all');
  if (blockedCheck.blocked) {
    throw new Error(blockedCheck.message);
  }

  const query = `
    SELECT 
      e.employee_id,
      e.name,
      a.id as attendance_id,
      a.login_time,
      a.logout_time,
      a.attendance_status
    FROM employees e
    LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.attendance_date = $1
    WHERE e.status = 'Active'
    ORDER BY e.employee_id ASC
  `;

  const result = await pool.query(query, [targetDate]);
  const rows = result.rows;

  const pendingCheckout = rows.filter(r => r.login_time && !r.logout_time);
  const alreadyCheckedOut = rows.filter(r => r.login_time && r.logout_time);
  const noCheckIn = rows.filter(r => !r.login_time);

  if (pendingCheckout.length === 0) {
    return {
      success: true,
      message: 'No employees are currently pending check-out today.',
      summary: {
        totalTargeted: 0,
        successCount: 0,
        skippedCount: rows.length,
        failedCount: 0
      },
      details: {
        successes: [],
        skipped: [
          ...alreadyCheckedOut.map(r => ({ employeeCode: r.employee_id, name: r.name, reason: 'Already checked out' })),
          ...noCheckIn.map(r => ({ employeeCode: r.employee_id, name: r.name, reason: 'No check-in today' }))
        ],
        failed: []
      }
    };
  }

  const successes = [];
  const skipped = [
    ...alreadyCheckedOut.map(r => ({ employeeCode: r.employee_id, name: r.name, reason: 'Already checked out' })),
    ...noCheckIn.map(r => ({ employeeCode: r.employee_id, name: r.name, reason: 'No check-in today' }))
  ];
  const failed = [];

  for (const emp of pendingCheckout) {
    try {
      const res = await quickCheckOutEmployee({
        employeeId: emp.employee_id,
        attendanceDate: targetDate,
        adminId,
        adminName,
        adminEmail,
        ipAddress,
        userAgent,
        reasonSource: 'Admin Assistant Bot check-out all'
      });
      const hrsInt = Math.floor(res.totalMinutes / 60);
      const minsInt = res.totalMinutes % 60;
      const formattedTotalStr = `${hrsInt}h ${minsInt}m`;

      successes.push({
        employeeCode: res.employeeCode,
        name: res.employeeName,
        totalHoursStr: formattedTotalStr,
        attendanceStatus: res.attendanceStatus
      });
    } catch (err) {
      console.error(`Check-out all failed for ${emp.employee_id}:`, err);
      failed.push({
        employeeCode: emp.employee_id,
        name: emp.name,
        reason: err.message
      });
    }
  }

  await logAdminActivity({
    adminId,
    adminName,
    adminEmail,
    actionType: 'Check-Out All',
    moduleName: 'Admin Assistant',
    description: `Marked check-out for all employees. Success: ${successes.length}, Skipped: ${skipped.length}, Failed: ${failed.length}`,
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: `Check-out completed for ${successes.length} employee(s).`,
    summary: {
      totalTargeted: pendingCheckout.length,
      successCount: successes.length,
      skippedCount: skipped.length,
      failedCount: failed.length
    },
    details: {
      successes,
      skipped,
      failed
    }
  };
};

module.exports = {
  getAttendanceBlockedReason,
  quickCheckInEmployee,
  quickCheckOutEmployee,
  checkOutAllEmployees
};
