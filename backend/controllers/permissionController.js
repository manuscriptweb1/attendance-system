const pool = require('../config/database');
const { logAdminActivity, MODULE_NAMES } = require('../services/adminActivityService');
const { getSettingsFromDB, clearSettingsCache } = require('../utils/settingsHelper');
const { parseTime, getLocalMinutesFromUTC, getOfficeTimes } = require('../utils/timeUtils');
const { buildMonthlyAttendanceMatrixAndSummary } = require('../services/attendanceReportService');

// Synchronize attendance record on the specific permission date
async function syncAttendanceWithDatePermissions(employeeId, dateStr) {
  try {
    if (!employeeId || !dateStr) return;

    // Check if an attendance record exists for this employee on this date
    const attRes = await pool.query(
      `SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2`,
      [employeeId, dateStr]
    );

    if (attRes.rows.length === 0) return;
    const att = attRes.rows[0];
    if (!att.login_time) return; // Not checked in, nothing to offset

    // Get total approved permission minutes for this employee on this exact date
    const permRes = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as perm_minutes
       FROM employee_permissions
       WHERE employee_id = $1 AND permission_date = $2 AND status = 'approved'`,
      [employeeId, dateStr]
    );
    const dayPermissionMinutes = parseInt(permRes.rows[0]?.perm_minutes || 0);

    const settings = await getSettingsFromDB();
    const officeTimes = getOfficeTimes(settings);
    const shiftSettings = settings.shiftSettings || {};
    const lunchStartInMinutes = parseTime(shiftSettings.lunchStartTime || '13:30');
    const eveningLateAfterInMinutes = parseTime(shiftSettings.eveningLateAfterTime || '14:00');
    const morningLateAfterInMinutes = officeTimes.lateTime;

    const loginMins = getLocalMinutesFromUTC(att.login_time);
    const isAfternoonCheckin = loginMins >= lunchStartInMinutes;
    const effectiveCutoff = isAfternoonCheckin ? eveningLateAfterInMinutes : morningLateAfterInMinutes;

    let checkin_status = 'on_time';
    let late_minutes = 0;
    let attendance_status = isAfternoonCheckin ? 'Half Day' : 'Present';

    if (loginMins > effectiveCutoff) {
      const rawLate = loginMins - effectiveCutoff;
      if (dayPermissionMinutes >= rawLate) {
        checkin_status = 'on_time';
        late_minutes = 0;
        attendance_status = isAfternoonCheckin ? 'Half Day' : 'Present';
      } else {
        checkin_status = 'late';
        late_minutes = rawLate - dayPermissionMinutes;
        attendance_status = isAfternoonCheckin ? 'Half Day' : 'Late';
      }
    } else {
      checkin_status = 'on_time';
      late_minutes = 0;
      attendance_status = isAfternoonCheckin ? 'Half Day' : (att.is_wfh ? 'Work From Home' : 'Present');
    }

    await pool.query(
      `UPDATE attendance 
       SET checkin_status = $1, late_minutes = $2, attendance_status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [checkin_status, late_minutes, attendance_status, att.id]
    );
  } catch (err) {
    console.error('syncAttendanceWithDatePermissions error:', err);
  }
}

const formatDuration = (mins) => {
  const total = Number(mins || 0);
  if (!total || total <= 0) return '0 min';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

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

    // Fetch monthly permission limit from settings
    const settings = await getSettingsFromDB();
    const limitMinutes = settings.permissions?.monthlyPermissionLimitMinutes || 240;

    // Unified SaaS Allowance Calculation:
    // Combines Counted Late Time + Approved Permission Time against the 4-hour limit!
    const monthYearPairs = new Set();
    if (month && year) {
      monthYearPairs.add(`${parseInt(month)}__${parseInt(year)}`);
    } else {
      result.rows.forEach(r => {
        if (r.permission_date) {
          const parts = String(r.permission_date).split('-');
          if (parts.length >= 2) {
            monthYearPairs.add(`${parseInt(parts[1])}__${parseInt(parts[0])}`);
          }
        }
      });
      if (monthYearPairs.size === 0) {
        const now = new Date();
        monthYearPairs.add(`${now.getMonth() + 1}__${now.getFullYear()}`);
      }
    }

    const quotaMap = {};
    for (const myStr of monthYearPairs) {
      const [m, y] = myStr.split('__').map(Number);
      try {
        const report = await buildMonthlyAttendanceMatrixAndSummary(m, y, employee_id || null);
        if (report && report.summaryRows) {
          report.summaryRows.forEach(s => {
            const countedLate = Number(s.totalCountedLateMinutes || 0);
            const permMins = Number(s.totalPermissionMinutes || 0);
            const totalUsed = Number(s.countedLateAndPermissionMinutes !== undefined 
              ? s.countedLateAndPermissionMinutes 
              : (countedLate + permMins));
            
            quotaMap[`${s.employeeCode}__${m}__${y}`] = {
              countedLateMinutes: countedLate,
              permissionMinutes: permMins,
              totalUsedMinutes: totalUsed,
              remainingMinutes: Math.max(0, limitMinutes - totalUsed),
              isExhausted: totalUsed >= limitMinutes
            };
          });
        }
      } catch (err) {
        console.error(`Error calculating unified allowance for ${m}/${y}:`, err);
      }
    }

    const enhancedPermissions = result.rows.map(r => {
      let pMonth = parseInt(month);
      let pYear = parseInt(year);
      if (r.permission_date) {
        const parts = String(r.permission_date).split('-');
        if (parts.length >= 2) {
          pYear = parseInt(parts[0]);
          pMonth = parseInt(parts[1]);
        }
      }
      const key = `${r.employee_id}__${pMonth}__${pYear}`;
      const q = quotaMap[key] || {
        countedLateMinutes: 0,
        permissionMinutes: Number(r.duration_minutes || 0),
        totalUsedMinutes: Number(r.duration_minutes || 0),
        remainingMinutes: Math.max(0, limitMinutes - Number(r.duration_minutes || 0)),
        isExhausted: Number(r.duration_minutes || 0) >= limitMinutes
      };

      return {
        ...r,
        monthly_limit_minutes: limitMinutes,
        monthly_used_minutes: q.totalUsedMinutes,
        permission_minutes: q.permissionMinutes,
        counted_late_minutes: q.countedLateMinutes,
        remaining_balance_minutes: q.remainingMinutes,
        is_quota_exhausted: q.isExhausted,
        formatted_remaining: formatDuration(q.remainingMinutes),
        formatted_used: formatDuration(q.totalUsedMinutes),
        formatted_limit: formatDuration(limitMinutes)
      };
    });

    res.json({ success: true, permissions: enhancedPermissions });
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

    // 3. Settings Monthly Limit
    const settings = await getSettingsFromDB();
    const limitMinutes = settings.permissions?.monthlyPermissionLimitMinutes || 240;

    const summary = {
      totalRecords: parseInt(recordsResult.rows[0].total_records),
      employeesWithPermission: parseInt(recordsResult.rows[0].employees_with_permission),
      totalPermissionMinutes: parseInt(recordsResult.rows[0].total_minutes),
      todayCount: parseInt(todayResult.rows[0].today_count),
      monthlyPermissionLimitMinutes: limitMinutes
    };

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Get permission summary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get monthly permission quota status for a specific employee
const getEmployeePermissionQuota = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID required' });
    }

    const m = month ? parseInt(month) : (new Date().getMonth() + 1);
    const y = year ? parseInt(year) : new Date().getFullYear();

    const settings = await getSettingsFromDB();
    const limitMinutes = settings.permissions?.monthlyPermissionLimitMinutes || 240;

    let countedLateMinutes = 0;
    let permissionMinutes = 0;
    let totalUsedMinutes = 0;

    try {
      const report = await buildMonthlyAttendanceMatrixAndSummary(m, y, employeeId);
      if (report && report.summaryRows && report.summaryRows.length > 0) {
        const s = report.summaryRows[0];
        countedLateMinutes = Number(s.totalCountedLateMinutes || 0);
        permissionMinutes = Number(s.totalPermissionMinutes || 0);
        totalUsedMinutes = Number(s.countedLateAndPermissionMinutes !== undefined 
          ? s.countedLateAndPermissionMinutes 
          : (countedLateMinutes + permissionMinutes));
      }
    } catch (err) {
      console.error('getEmployeePermissionQuota report error:', err);
      const usedResult = await pool.query(
        `SELECT COALESCE(SUM(duration_minutes), 0) as used_minutes
         FROM employee_permissions
         WHERE employee_id = $1 
           AND EXTRACT(MONTH FROM permission_date) = $2
           AND EXTRACT(YEAR FROM permission_date) = $3
           AND status = 'approved'`,
        [employeeId, m, y]
      );
      permissionMinutes = parseInt(usedResult.rows[0]?.used_minutes || 0);
      totalUsedMinutes = permissionMinutes;
    }

    const remainingMinutes = Math.max(0, limitMinutes - totalUsedMinutes);

    res.json({
      success: true,
      employeeId,
      month: m,
      year: y,
      limitMinutes,
      usedMinutes: totalUsedMinutes,
      permissionMinutes,
      countedLateMinutes,
      remainingMinutes,
      isExhausted: totalUsedMinutes >= limitMinutes,
      formattedLimit: formatDuration(limitMinutes),
      formattedUsed: formatDuration(totalUsedMinutes),
      formattedRemaining: formatDuration(remainingMinutes)
    });
  } catch (error) {
    console.error('Get employee permission quota error:', error);
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

    // Extract month and year from permission_date (YYYY-MM-DD)
    const dateParts = permission_date.split('-');
    const pYear = parseInt(dateParts[0]);
    const pMonth = parseInt(dateParts[1]);

    // Check monthly quota (Option A: Hard limit check)
    const settings = await getSettingsFromDB();
    const limitMinutes = settings.permissions?.monthlyPermissionLimitMinutes || 240;

    const usedResult = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as used_minutes
       FROM employee_permissions
       WHERE employee_id = $1 
         AND EXTRACT(MONTH FROM permission_date) = $2
         AND EXTRACT(YEAR FROM permission_date) = $3
         AND status = 'approved'`,
      [employee_id, pMonth, pYear]
    );

    const usedMinutes = parseInt(usedResult.rows[0].used_minutes || 0);
    const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);

    if (usedMinutes >= limitMinutes) {
      return res.status(400).json({
        success: false,
        message: `Monthly permission limit reached (${formatDuration(limitMinutes)}). ${employee_name || 'Employee'} has already used ${formatDuration(usedMinutes)} this month.`,
        code: 'PERMISSION_LIMIT_REACHED'
      });
    }

    if (duration_minutes > remainingMinutes) {
      return res.status(400).json({
        success: false,
        message: `Requested permission (${formatDuration(duration_minutes)}) exceeds remaining monthly allowance (${formatDuration(remainingMinutes)} remaining of ${formatDuration(limitMinutes)}).`,
        code: 'PERMISSION_DURATION_EXCEEDS_REMAINING'
      });
    }

    // Insert into DB
    const numericAdminId = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;
    const result = await pool.query(
      `INSERT INTO employee_permissions 
       (employee_id, employee_name, department_name, permission_date, from_time, to_time, duration_minutes, reason, created_by_admin_id, created_by_admin_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [employee_id, employee_name, department_name, permission_date, from_time, to_time, duration_minutes, reason, numericAdminId, req.user?.username || 'Admin']
    );

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

    // Synchronize attendance record on this exact permission date (if checked in)
    await syncAttendanceWithDatePermissions(employee_id, permission_date);

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

    const dateParts = permission_date.split('-');
    const pYear = parseInt(dateParts[0]);
    const pMonth = parseInt(dateParts[1]);

    // Check monthly quota excluding this record
    const settings = await getSettingsFromDB();
    const limitMinutes = settings.permissions?.monthlyPermissionLimitMinutes || 240;

    const usedResult = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as used_minutes
       FROM employee_permissions
       WHERE employee_id = $1 
         AND id != $2
         AND EXTRACT(MONTH FROM permission_date) = $3
         AND EXTRACT(YEAR FROM permission_date) = $4
         AND status = 'approved'`,
      [oldData.employee_id, id, pMonth, pYear]
    );

    const otherUsedMinutes = parseInt(usedResult.rows[0].used_minutes || 0);
    const remainingMinutes = Math.max(0, limitMinutes - otherUsedMinutes);

    if (otherUsedMinutes >= limitMinutes) {
      return res.status(400).json({
        success: false,
        message: `Monthly permission limit reached (${formatDuration(limitMinutes)}). Employee has already used ${formatDuration(otherUsedMinutes)} in other permissions this month.`,
        code: 'PERMISSION_LIMIT_REACHED'
      });
    }

    if (duration_minutes > remainingMinutes) {
      return res.status(400).json({
        success: false,
        message: `Updated duration (${formatDuration(duration_minutes)}) exceeds remaining monthly allowance (${formatDuration(remainingMinutes)} remaining of ${formatDuration(limitMinutes)}).`,
        code: 'PERMISSION_DURATION_EXCEEDS_REMAINING'
      });
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

    // Synchronize attendance records on both new and previous permission dates
    const oldDateStr = new Date(oldData.permission_date).toISOString().split('T')[0];
    await syncAttendanceWithDatePermissions(newData.employee_id, permission_date);
    if (oldDateStr !== permission_date) {
      await syncAttendanceWithDatePermissions(oldData.employee_id, oldDateStr);
    }

    res.json({ success: true, permission: newData });
  } catch (error) {
    console.error('Update permission error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ success: false, message: 'Permission record already exists for this exact time' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updatePermissionLimit = async (req, res) => {
  try {
    const { limitMinutes } = req.body;
    const mins = parseInt(limitMinutes);
    if (isNaN(mins) || mins <= 0) {
      return res.status(400).json({ success: false, message: 'Limit minutes must be a valid positive number' });
    }

    await pool.query(
      `UPDATE settings 
       SET monthly_permission_limit_minutes = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM settings ORDER BY id LIMIT 1)`,
      [mins]
    );

    clearSettingsCache();

    await logAdminActivity({
      adminId: req.user?.id,
      adminName: req.user?.username || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'UPDATE_PERMISSION_LIMIT',
      moduleName: MODULE_NAMES.PERMISSIONS || 'Permissions',
      description: `Updated monthly permission limit to ${formatDuration(mins)} (${mins} minutes)`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      limitMinutes: mins,
      formattedLimit: formatDuration(mins),
      message: `Monthly permission limit updated to ${formatDuration(mins)}`
    });
  } catch (error) {
    console.error('Update permission limit error:', error);
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

    // Synchronize attendance record on this deleted permission date
    await syncAttendanceWithDatePermissions(oldData.employee_id, oldDateStr);

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
  getEmployeePermissionQuota,
  createPermission,
  updatePermission,
  updatePermissionLimit,
  deletePermission,
  clearPermissionRange
};
