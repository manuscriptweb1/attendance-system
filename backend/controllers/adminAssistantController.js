const pool = require('../config/database');
const { buildMonthlyPayroll, buildMonthlyAttendanceMatrixAndSummary } = require('../services/attendanceReportService');
const { logAdminActivity, MODULE_NAMES, ADMIN_ACTION_TYPES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { getIndiaDateTime, getOfficeTimes, calculateCheckInStatus, calculateCheckOutStatus, calculateWorkedMinutes, formatTime12Hour } = require('../utils/timeUtils');
const { quickCheckInEmployee, quickCheckOutEmployee, checkOutAllEmployees, getAttendanceBlockedReason } = require('../services/manualAttendanceService');
const commandsConfig = require('../config/adminAssistantCommands.json');

const getBotCapabilities = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: commandsConfig
    });
  } catch (error) {
    console.error('Get bot capabilities error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bot capabilities'
    });
  }
};

const generateGeneralHelpFromJSON = () => {
  let text = `I can help you with these actions:\n\n`;
  commandsConfig.actions.forEach((action, idx) => {
    text += `${idx + 1}. ${action.title}\n`;
    if (action.description) {
      text += `${action.description}\n`;
    }
    text += `Examples:\n`;
    action.commands.forEach((cmd) => {
      text += `- ${cmd}\n`;
    });
    if (idx < commandsConfig.actions.length - 1) {
      text += `\n`;
    }
  });
  return text.trim();
};

const findMatchingActionInJSON = (query) => {
  let text = (query || '').toLowerCase().trim();
  if (!text) return null;

  if (text.startsWith('help_')) {
    text = text.replace('help_', '');
  }

  let matched = commandsConfig.actions.find(action =>
    action.id.toLowerCase() === text ||
    action.title.toLowerCase() === text
  );
  if (matched) return matched;

  matched = commandsConfig.actions.find(action =>
    action.keywords && action.keywords.some(kw => text.includes(kw.toLowerCase()))
  );
  if (matched) return matched;

  matched = commandsConfig.actions.find(action =>
    action.aliases && action.aliases.some(alias => text.includes(alias.toLowerCase()))
  );
  if (matched) return matched;

  matched = commandsConfig.actions.find(action =>
    action.commands && action.commands.some(cmd => text.includes(cmd.toLowerCase()))
  );
  return matched;
};

const generateSpecificHelpFromJSON = (action) => {
  if (!action) return null;
  let text = `You can use these ${action.title} commands:\n\n`;
  action.commands.forEach((cmd) => {
    text += `- ${cmd}\n`;
  });
  return text.trim();
};

/**
 * Helper to check permissions securely
 */
const checkPermission = (req, pageKey, action = 'can_view') => {
  const u = req.user;
  if (!u) return false;
  
  const normalizeRole = (r) => String(r || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const isSuper = u.is_super_admin === true || u.isSuperAdmin === true || u.emergency_admin === true || normalizeRole(u.role) === 'super admin' || normalizeRole(u.role) === 'superadmin';
  if (isSuper) return true;

  if (!u.permissions || !u.permissions[pageKey]) return false;
  return u.permissions[pageKey][action] === true;
};

// Helper function to convert 24-hour time or TIMESTAMP to 12-hour AM/PM format
const format12HourTime = (timeInput) => {
  if (!timeInput) return 'N/A';
  
  let timeStr = timeInput;
  if (timeInput instanceof Date) {
    timeStr = timeInput.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
    return timeStr;
  }
  
  const strVal = String(timeInput).trim();
  if (strVal.includes('T') || strVal.includes(' ')) {
    const d = new Date(strVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
    }
  }

  const [hours, minutes] = strVal.split(':');
  if (hours !== undefined && minutes !== undefined) {
    const hour = parseInt(hours, 10);
    const min = minutes.substring(0, 2);
    if (isNaN(hour)) return strVal;
    
    if (hour === 0) return `12:${min} AM`;
    if (hour < 12) return `${hour}:${min} AM`;
    if (hour === 12) return `12:${min} PM`;
    return `${hour - 12}:${min} PM`;
  }

  return strVal;
};

const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INSIGHT_METRICS = ['late', 'absent', 'half_day'];
const DEFAULT_PATTERN_THRESHOLD = 3;

// Today's date in India (YYYY-MM-DD), same source used when the bot marks attendance
const getTodayIST = () => getIndiaDateTime().split('T')[0];

const formatDisplayDate = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return String(ymd);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const formatMinutesText = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (!total) return '0 min';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
};

const canViewAttendanceData = (req) =>
  checkPermission(req, 'attendance', 'can_view') || checkPermission(req, 'reports', 'can_view');

const isNotMarkedStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return s === '' || s === 'not mention' || s === 'not mentioned' || s === 'not_mention';
};

// Explains why many employees may have no attendance today (Sunday / holiday)
const getTodayDayNote = async (todayStr) => {
  const [y, m, d] = todayStr.split('-').map(Number);
  const isSun = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
  try {
    const h = await pool.query(
      'SELECT holiday_title, holiday_type FROM holidays WHERE holiday_date = $1 AND is_enabled = true LIMIT 1',
      [todayStr]
    );
    if (h.rows[0]) {
      const { holiday_title: title, holiday_type: type } = h.rows[0];
      return `Today is a holiday: ${title}${type ? ` (${type})` : ''}.`;
    }
  } catch (err) {
    console.warn('Holiday lookup for bot day note failed:', err.message);
  }
  return isSun ? 'Today is Sunday (weekly off).' : null;
};

// One row per active employee with today's attendance record (if any)
const getTodayEmployeeRows = async (todayStr) => {
  const result = await pool.query(
    `SELECT e.employee_id AS employee_code, e.name, d.name AS department_name,
            a.id AS attendance_id, a.attendance_status, a.absent_reason, a.login_time, a.logout_time,
            a.late_minutes, a.validation_method, a.total_working_hours
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id
     LEFT JOIN attendance a
       ON (a.employee_id::text = e.employee_id::text OR a.employee_id::text = e.id::text)
      AND a.attendance_date = $1
     WHERE LOWER(e.status) = 'active'
     ORDER BY e.name ASC, a.login_time ASC NULLS LAST`,
    [todayStr]
  );

  // Keep the most informative record per employee (a checked-in or marked record wins over an empty one)
  const byCode = new Map();
  result.rows.forEach((row) => {
    const existing = byCode.get(row.employee_code);
    const score = (r) => (r.login_time ? 2 : 0) + (r.attendance_id && !isNotMarkedStatus(r.attendance_status) ? 1 : 0);
    if (!existing || score(row) > score(existing)) {
      byCode.set(row.employee_code, row);
    }
  });
  return Array.from(byCode.values());
};

const getTodayPaidLeaves = async (todayStr) => {
  try {
    const res = await pool.query(
      `SELECT pl.employee_id AS employee_code, e.name, d.name AS department_name, pl.reason_category, pl.reason_notes
       FROM paid_leaves pl
       JOIN employees e ON e.employee_id = pl.employee_id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE pl.leave_date = $1
       ORDER BY e.name ASC`,
      [todayStr]
    );
    return res.rows;
  } catch (err) {
    console.warn('Paid leave lookup for bot failed:', err.message);
    return [];
  }
};

const toTodayItem = (row, extra = {}) => ({
  employeeCode: row.employee_code,
  name: row.name,
  department: row.department_name || 'N/A',
  status: row.attendance_status || 'Not Mention',
  checkIn: row.login_time ? formatTime12Hour(row.login_time) : null,
  checkOut: row.logout_time ? formatTime12Hour(row.logout_time) : null,
  lateMinutes: Number(row.late_minutes) > 0 ? Number(row.late_minutes) : 0,
  ...extra
});

const formatShortDate = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });

// Collects the dated details (late / absent / half day) for one employee from the monthly matrix
const collectEmployeeDayDetails = (matrixRow, month, year) => {
  const lateDays = [];
  const absentDays = [];
  const halfDays = [];
  const days = (matrixRow && matrixRow.days) || {};

  Object.keys(days)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((day) => {
      const info = days[day];
      if (!info) return;
      const record = info.record || {};
      const base = { day, date: formatShortDate(year, month, day) };
      if (info.code === 'L') {
        // Same per-day counted late minutes the Reports page uses (shift-aware, permission adjusted)
        const netLate = info.countedLateMinutes !== undefined
          ? Math.max(0, Number(info.countedLateMinutes) || 0)
          : Math.max(0, (Number(record.late_minutes) || 0) - (Number(info.permissionMinutes) || 0));
        lateDays.push({
          ...base,
          checkIn: record.login_time ? formatTime12Hour(record.login_time) : null,
          lateMinutes: netLate,
          lateText: netLate > 0 ? formatMinutesText(netLate) : null
        });
      } else if (info.code === 'A') {
        absentDays.push({ ...base, reason: info.absentReason || record.absent_reason || null });
      } else if (info.code === 'HD') {
        halfDays.push({
          ...base,
          checkIn: record.login_time ? formatTime12Hour(record.login_time) : null,
          checkOut: record.logout_time ? formatTime12Hour(record.logout_time) : null
        });
      }
    });

  return { lateDays, absentDays, halfDays };
};

/**
 * Handle Bot Commands on Backend
 */
const handleBotCommand = async (req, res) => {
  try {
    const { action, payload } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.username || req.user.name || 'Admin';
    const adminEmail = req.user.email || '';
    const ipAddress = getClientIP(req);
    const browserInfo = req.headers['user-agent'];

    switch (action) {
      case 'log_navigation': {
        const { targetPage, path } = payload || {};
        await logAdminActivity({
          adminId,
          adminName,
          adminEmail,
          actionType: 'NAVIGATION',
          moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
          description: `Opened ${targetPage || 'page'} (${path}) using Admin Assistant`,
          ipAddress,
          browserInfo,
          source: 'ADMIN_ASSISTANT'
        });
        return res.json({ success: true, message: `Logged navigation to ${targetPage}` });
      }

      case 'search_employee': {
        if (!checkPermission(req, 'employees', 'can_view')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view employees.'
          });
        }

        const query = String(payload?.query || '').trim();
        if (!query) {
          return res.json({
            success: true,
            type: 'employee_search',
            message: 'Please provide an employee name, code, email, or mobile number to search.',
            data: []
          });
        }

        try {
          const searchRes = await pool.query(
            `SELECT
               e.id,
               e.employee_id,
               e.name,
               e.email,
               e.mobile,
               e.job_role as designation,
               e.status,
               d.name as department_name,
               ta.attendance_status AS today_status,
               ta.login_time AS today_login,
               ta.logout_time AS today_logout,
               ta.late_minutes AS today_late_minutes,
               ta.absent_reason AS today_absent_reason
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             LEFT JOIN LATERAL (
               SELECT a.attendance_status, a.login_time, a.logout_time, a.late_minutes, a.absent_reason
               FROM attendance a
               WHERE (a.employee_id::text = e.employee_id::text OR a.employee_id::text = e.id::text)
                 AND a.attendance_date = $2
               ORDER BY a.login_time ASC NULLS LAST
               LIMIT 1
             ) ta ON true
             WHERE e.employee_id ILIKE $1
                OR e.name ILIKE $1
                OR LOWER(REPLACE(e.name, ' ', '')) LIKE LOWER(REPLACE($1, ' ', ''))
                OR LOWER(COALESCE(e.email, '')) ILIKE $1
                OR LOWER(COALESCE(e.mobile, '')) ILIKE $1
             ORDER BY e.name ASC
             LIMIT 10`,
            [`%${query}%`, getTodayIST()]
          );

          const employees = searchRes.rows.map(r => {
            const notMarked = !r.today_login && isNotMarkedStatus(r.today_status);
            return {
              id: r.id,
              employeeCode: r.employee_id,
              name: r.name,
              email: r.email || 'N/A',
              phone: r.mobile || 'N/A',
              designation: r.designation || 'N/A',
              department: r.department_name || 'N/A',
              status: r.status || 'Active',
              today: {
                status: notMarked ? 'Not Marked' : (r.today_status || 'Present'),
                checkIn: r.today_login ? formatTime12Hour(r.today_login) : null,
                checkOut: r.today_logout ? formatTime12Hour(r.today_logout) : null,
                lateMinutes: Number(r.today_late_minutes) > 0 ? Number(r.today_late_minutes) : 0,
                absentReason: r.today_absent_reason || null
              }
            };
          });

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'EMPLOYEE SEARCH',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Searched employee query "${query}". Found ${employees.length} record(s).`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          if (employees.length === 0) {
            return res.json({
              success: true,
              type: 'employee_search',
              message: `No employee found for "${query}". Please check the name or employee ID.`,
              data: []
            });
          }

          return res.json({
            success: true,
            type: 'employee_search',
            message: `Found ${employees.length} matching employee(s):`,
            data: employees
          });
        } catch (dbErr) {
          console.error('Employee search DB query error:', dbErr);
          return res.json({
            success: false,
            message: `I could not search employees right now. Please check employee data or try again.`
          });
        }
      }

      case 'today_absent': {
        if (!canViewAttendanceData(req)) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        try {
          const todayStr = getTodayIST();
          const [rows, paidLeaves, dayNote] = await Promise.all([
            getTodayEmployeeRows(todayStr),
            getTodayPaidLeaves(todayStr),
            getTodayDayNote(todayStr)
          ]);

          const leaveByCode = new Map(paidLeaves.map((pl) => [pl.employee_code, pl]));

          const absentList = [];
          const notMentionList = [];
          rows.forEach((r) => {
            const status = String(r.attendance_status || '').trim().toLowerCase();
            const onPaidLeave = leaveByCode.has(r.employee_code) || r.validation_method === 'Paid Leave';
            if (onPaidLeave) return;
            if (status === 'absent') {
              absentList.push({
                employeeCode: r.employee_code,
                name: r.name,
                department: r.department_name || 'N/A',
                reason: r.absent_reason || null
              });
            } else if (!r.login_time && isNotMarkedStatus(r.attendance_status)) {
              notMentionList.push({
                employeeCode: r.employee_code,
                name: r.name,
                department: r.department_name || 'N/A'
              });
            }
          });

          const onLeaveList = paidLeaves.map((pl) => ({
            employeeCode: pl.employee_code,
            name: pl.name,
            department: pl.department_name || 'N/A',
            reason: [pl.reason_category, pl.reason_notes].filter(Boolean).join(' - ') || 'Paid Leave'
          }));

          const todayDateStr = formatDisplayDate(todayStr);

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'TODAY ABSENT QUERY',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Viewed today's absent list (${todayDateStr}). Marked Absent: ${absentList.length}, Not Mention: ${notMentionList.length}, On Leave: ${onLeaveList.length}.`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'today_absent',
            message: `Today's Absent Details - ${todayDateStr}\nMarked Absent: ${absentList.length} | Not Marked Yet: ${notMentionList.length} | On Leave: ${onLeaveList.length}`,
            data: {
              absent: absentList,
              notMention: notMentionList,
              onLeave: onLeaveList,
              dayNote,
              dateStr: todayDateStr
            }
          });
        } catch (dbErr) {
          console.error('Today absent DB query error:', dbErr);
          return res.json({
            success: false,
            message: 'Today\'s absent list could not be loaded right now. Please try again.'
          });
        }
      }

      case 'today_late': {
        if (!canViewAttendanceData(req)) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        try {
          const todayStr = getTodayIST();
          const rows = await getTodayEmployeeRows(todayStr);

          const lateEmployees = rows
            .filter((r) => String(r.attendance_status || '').trim().toLowerCase() === 'late')
            .map((r) => {
              const lateMinutes = Number(r.late_minutes) > 0 ? Number(r.late_minutes) : 0;
              return {
                employeeCode: r.employee_code,
                name: r.name,
                department: r.department_name || 'N/A',
                checkInTime: r.login_time ? formatTime12Hour(r.login_time) : 'N/A',
                checkOutTime: r.logout_time ? formatTime12Hour(r.logout_time) : null,
                lateMinutes,
                lateText: lateMinutes > 0 ? formatMinutesText(lateMinutes) : null
              };
            })
            .sort((a, b) => b.lateMinutes - a.lateMinutes);

          const totalLateMinutes = lateEmployees.reduce((sum, l) => sum + l.lateMinutes, 0);
          const todayDateStr = formatDisplayDate(todayStr);

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'TODAY LATE QUERY',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Viewed today's late list (${todayDateStr}). Total late: ${lateEmployees.length}.`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'today_late',
            message: lateEmployees.length > 0
              ? `Late Employees Today - ${todayDateStr}\nTotal: ${lateEmployees.length} | Combined late time: ${formatMinutesText(totalLateMinutes)}`
              : `Late Employees Today - ${todayDateStr}\nNo one is late so far today.`,
            data: lateEmployees
          });
        } catch (dbErr) {
          console.error('Today late DB query error:', dbErr);
          return res.json({
            success: false,
            message: 'Today\'s late list could not be loaded right now. Please try again.'
          });
        }
      }

      case 'today_summary': {
        if (!canViewAttendanceData(req)) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        try {
          const todayStr = getTodayIST();
          const [rows, paidLeaves] = await Promise.all([
            getTodayEmployeeRows(todayStr),
            getTodayPaidLeaves(todayStr)
          ]);
          const leaveCodes = new Set(paidLeaves.map((pl) => pl.employee_code));

          const summary = { present: 0, late: 0, absent: 0, halfDay: 0, working: 0, notMention: 0, onLeave: 0 };
          rows.forEach((r) => {
            const status = String(r.attendance_status || '').trim().toLowerCase();
            if (r.login_time && !r.logout_time) summary.working++;
            if (leaveCodes.has(r.employee_code) || r.validation_method === 'Paid Leave') {
              summary.onLeave++;
            } else if (status === 'present') summary.present++;
            else if (status === 'late') summary.late++;
            else if (status === 'absent') summary.absent++;
            else if (status === 'half day') summary.halfDay++;
            else if (!r.login_time && isNotMarkedStatus(r.attendance_status)) summary.notMention++;
          });

          const todayDateStr = formatDisplayDate(todayStr);

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'TODAY ATTENDANCE SUMMARY',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Viewed today's attendance summary (${todayDateStr}). Present: ${summary.present}, Late: ${summary.late}, Absent: ${summary.absent}, Working: ${summary.working}.`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'today_summary',
            message: `Today Attendance Summary - ${todayDateStr}\nActive employees: ${rows.length}`,
            data: summary
          });
        } catch (dbErr) {
          console.error('Today summary DB query error:', dbErr);
          return res.json({
            success: false,
            message: 'Today\'s attendance summary could not be loaded right now. Please try again.'
          });
        }
      }

      case 'today_status_list': {
        if (!canViewAttendanceData(req)) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        const listType = String(payload?.status || '').trim().toLowerCase();
        const LIST_TITLES = {
          present: 'Present Employees Today',
          working: 'Still Working (Checked In, Not Checked Out)',
          checked_out: 'Checked Out Today',
          half_day: 'Half Day Today',
          leave: 'On Leave Today',
          permission: 'Permissions Today'
        };
        if (!LIST_TITLES[listType]) {
          return res.json({
            success: false,
            message: 'Please choose present, still working, checked out, half day, on leave, or permissions.'
          });
        }

        try {
          const todayStr = getTodayIST();
          const todayDateStr = formatDisplayDate(todayStr);
          let items = [];

          if (listType === 'leave') {
            const paidLeaves = await getTodayPaidLeaves(todayStr);
            items = paidLeaves.map((pl) => ({
              employeeCode: pl.employee_code,
              name: pl.name,
              department: pl.department_name || 'N/A',
              status: 'Paid Leave',
              reason: [pl.reason_category, pl.reason_notes].filter(Boolean).join(' - ') || 'Paid Leave'
            }));
          } else if (listType === 'permission') {
            const permRes = await pool.query(
              `SELECT p.employee_id AS employee_code, COALESCE(e.name, p.employee_name) AS name,
                      COALESCE(d.name, p.department_name) AS department_name,
                      p.from_time, p.to_time, p.duration_minutes, p.reason, p.status
               FROM employee_permissions p
               LEFT JOIN employees e ON e.employee_id = p.employee_id
               LEFT JOIN departments d ON e.department_id = d.id
               WHERE p.permission_date = $1
               ORDER BY p.from_time ASC`,
              [todayStr]
            );
            items = permRes.rows.map((p) => ({
              employeeCode: p.employee_code,
              name: p.name,
              department: p.department_name || 'N/A',
              status: p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Approved',
              detail: `${formatTime12Hour(String(p.from_time).substring(0, 5))} - ${formatTime12Hour(String(p.to_time).substring(0, 5))} (${formatMinutesText(p.duration_minutes)})`,
              reason: p.reason || null
            }));
          } else {
            const rows = await getTodayEmployeeRows(todayStr);
            const matches = rows.filter((r) => {
              const status = String(r.attendance_status || '').trim().toLowerCase();
              if (listType === 'present') return !!r.login_time && status !== 'absent';
              if (listType === 'working') return !!r.login_time && !r.logout_time;
              if (listType === 'checked_out') return !!r.login_time && !!r.logout_time;
              if (listType === 'half_day') return status === 'half day';
              return false;
            });
            items = matches.map((r) => toTodayItem(r));
          }

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'TODAY STATUS LIST',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Viewed "${LIST_TITLES[listType]}" (${todayDateStr}). Total: ${items.length}.`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'today_status_list',
            message: `${LIST_TITLES[listType]} - ${todayDateStr}\nTotal: ${items.length}`,
            data: { status: listType, title: LIST_TITLES[listType], items, dateStr: todayDateStr }
          });
        } catch (dbErr) {
          console.error('Today status list error:', dbErr);
          return res.json({
            success: false,
            message: 'This list could not be loaded right now. Please try again.'
          });
        }
      }

      case 'attendance_insights': {
        if (!canViewAttendanceData(req)) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        const [todayYear, todayMonth, todayDay] = getTodayIST().split('-').map(Number);
        const metric = INSIGHT_METRICS.includes(payload?.metric) ? payload.metric : 'late';
        const reqMonth = parseInt(payload?.month, 10);
        const reqYear = parseInt(payload?.year, 10);
        const month = reqMonth >= 1 && reqMonth <= 12 ? reqMonth : todayMonth;
        const year = reqYear >= 2000 && reqYear <= 2100 ? reqYear : todayYear;
        const reqThreshold = parseInt(payload?.threshold, 10);
        const threshold = reqThreshold >= 1 && reqThreshold <= 31 ? reqThreshold : DEFAULT_PATTERN_THRESHOLD;
        const employeeQuery = payload?.employeeQuery ? String(payload.employeeQuery).trim() : '';
        const monthName = MONTH_NAMES_FULL[month - 1];
        const periodLabel = `${monthName} ${year}`;
        const isFutureMonth = year > todayYear || (year === todayYear && month > todayMonth);

        if (isFutureMonth) {
          return res.json({
            success: true,
            type: 'attendance_insights',
            message: `${periodLabel} has not started yet, so there is no attendance data to analyse.`,
            data: { metric, month, year, monthName, periodLabel, threshold, frequent: [], occasional: [], totalEmployees: 0 }
          });
        }

        try {
          const { summaryRows, matrixRows } = await buildMonthlyAttendanceMatrixAndSummary(month, year);
          const matrixByCode = new Map((matrixRows || []).map((m) => [m.employeeCode, m]));
          const isCurrentMonth = year === todayYear && month === todayMonth;
          const coverage = isCurrentMonth ? ` (1-${todayDay} ${monthName.substring(0, 3)})` : '';

          let notice = null;
          let candidates = summaryRows || [];

          if (employeeQuery) {
            const q = employeeQuery.toLowerCase();
            const qCompact = q.replace(/\s+/g, '');
            const exact = candidates.filter((r) =>
              String(r.employeeCode || '').toLowerCase() === q ||
              String(r.employeeName || '').toLowerCase() === q
            );
            const matched = exact.length === 1 ? exact : candidates.filter((r) =>
              String(r.employeeCode || '').toLowerCase().includes(q) ||
              String(r.employeeName || '').toLowerCase().includes(q) ||
              String(r.employeeName || '').toLowerCase().replace(/\s+/g, '').includes(qCompact)
            );

            if (matched.length > 1) {
              return res.json({
                success: true,
                type: 'multiple_employees_found',
                message: `I found ${matched.length} employees matching "${employeeQuery}". Please select one:`,
                data: matched.map((m) => ({
                  id: m.employeeId,
                  employeeCode: m.employeeCode,
                  name: m.employeeName,
                  department: m.department
                })),
                metric,
                month,
                year
              });
            }

            if (matched.length === 1) {
              const emp = matched[0];
              const details = collectEmployeeDayDetails(matrixByCode.get(emp.employeeCode), month, year);
              const counts = { late: emp.lateCount || 0, absent: emp.absent || 0, half_day: emp.halfDay || 0 };
              const focusCount = counts[metric];
              const metricWord = metric === 'late' ? 'late' : metric === 'absent' ? 'absent' : 'on half day';
              const pattern = focusCount >= threshold
                ? `Pattern: ${metricWord} ${focusCount} times this period (${threshold}+ is flagged as frequent).`
                : focusCount > 0
                  ? `Pattern: ${metricWord} ${focusCount} time${focusCount === 1 ? '' : 's'} this period (below the ${threshold}+ frequent level).`
                  : `Pattern: not ${metricWord} even once this period.`;

              await logAdminActivity({
                adminId, adminName, adminEmail,
                actionType: 'ATTENDANCE INSIGHTS',
                moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
                description: `Viewed ${metric} details for ${emp.employeeCode} - ${emp.employeeName} for ${periodLabel} using Admin Assistant.`,
                ipAddress, browserInfo,
                source: 'ADMIN_ASSISTANT'
              });

              return res.json({
                success: true,
                type: 'attendance_insights_employee',
                message: `Attendance Details - ${emp.employeeCode} - ${emp.employeeName}\n${periodLabel}${coverage}\n${pattern}`,
                data: {
                  metric,
                  month,
                  year,
                  monthName,
                  periodLabel,
                  threshold,
                  employee: {
                    employeeCode: emp.employeeCode,
                    name: emp.employeeName,
                    department: emp.department || 'N/A',
                    present: emp.present || 0,
                    late: counts.late,
                    absent: counts.absent,
                    halfDay: counts.half_day,
                    lateTimeText: formatMinutesText(emp.totalCountedLateMinutes),
                    permissionTimeText: formatMinutesText(emp.totalPermissionMinutes),
                    totalHours: emp.totalHours || 0
                  },
                  ...details
                }
              });
            }

            notice = `No employee matched "${employeeQuery}", so I am showing all employees.`;
          }

          const ranked = candidates
            .map((r) => {
              const count = metric === 'late' ? (r.lateCount || 0) : metric === 'absent' ? (r.absent || 0) : (r.halfDay || 0);
              const details = collectEmployeeDayDetails(matrixByCode.get(r.employeeCode), month, year);
              const dayList = metric === 'late' ? details.lateDays : metric === 'absent' ? details.absentDays : details.halfDays;
              return {
                employeeCode: r.employeeCode,
                name: r.employeeName,
                department: r.department || 'N/A',
                count,
                lateMinutes: Number(r.totalCountedLateMinutes) || 0,
                lateTimeText: formatMinutesText(r.totalCountedLateMinutes),
                dates: dayList
              };
            })
            .filter((r) => r.count > 0)
            .sort((a, b) => (b.count - a.count) || (b.lateMinutes - a.lateMinutes) || a.name.localeCompare(b.name));

          const frequent = ranked.filter((r) => r.count >= threshold);
          const occasional = ranked.filter((r) => r.count < threshold);

          const labels = {
            late: { title: 'Consistently Late Employees', noun: 'late', none: 'No late arrivals were recorded' },
            absent: { title: 'Frequently Absent Employees', noun: 'absent', none: 'No absences were recorded' },
            half_day: { title: 'Frequent Half Days', noun: 'on half day', none: 'No half days were recorded' }
          }[metric];

          let headline;
          if (ranked.length === 0) {
            headline = `${labels.none} in ${periodLabel}.`;
          } else if (frequent.length === 0) {
            headline = `No employee was ${labels.noun} ${threshold} or more times. ${occasional.length} employee${occasional.length === 1 ? ' was' : 's were'} ${labels.noun} 1-${threshold - 1} time${threshold - 1 === 1 ? '' : 's'}.`;
          } else {
            headline = `${frequent.length} employee${frequent.length === 1 ? ' was' : 's were'} ${labels.noun} ${threshold} or more times.`;
          }

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'ATTENDANCE INSIGHTS',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Viewed ${labels.title.toLowerCase()} for ${periodLabel}. Frequent: ${frequent.length}, Occasional: ${occasional.length}.`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'attendance_insights',
            message: `${labels.title} - ${periodLabel}${coverage}\n${notice ? `${notice}\n` : ''}${headline}`,
            data: {
              metric,
              month,
              year,
              monthName,
              periodLabel,
              threshold,
              frequent,
              occasional,
              totalEmployees: candidates.length
            }
          });
        } catch (dbErr) {
          console.error('Attendance insights error:', dbErr);
          return res.json({
            success: false,
            message: 'The late/absent analysis could not be generated right now. Please try again.'
          });
        }
      }

      case 'report_summary': {
        if (!checkPermission(req, 'reports', 'can_view')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        const now = new Date();
        const month = parseInt(payload?.month) || (now.getMonth() + 1);
        const year = parseInt(payload?.year) || now.getFullYear();
        const query = payload?.employeeQuery ? String(payload.employeeQuery).trim() : null;

        try {
          const { summaryRows, matrixRows, absentTable, holidayTable } = await buildMonthlyAttendanceMatrixAndSummary(month, year);
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const monthName = monthNames[month - 1] || month;

          // Save / update report snapshot in database so Reports page reflects fresh data
          try {
            const daysInMonth = new Date(year, month, 0).getDate();
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

            const dailyAttendanceMatrix = {
              days,
              employees: (matrixRows || []).map(m => {
                const daysMap = {};
                const detailsMap = {};
                for (let d = 1; d <= daysInMonth; d++) {
                  daysMap[d] = m.days && m.days[d] ? m.days[d].code : '-';
                  detailsMap[d] = m.days && m.days[d] ? {
                    code: m.days[d].code,
                    permissionMinutes: m.days[d].permissionMinutes || 0,
                    record: m.days[d].record || null,
                    absentReason: m.days[d].absentReason || (m.days[d].record ? m.days[d].record.absent_reason : null),
                    paidLeaveReason: m.days[d].paidLeaveReason || null,
                    holidayInfo: m.days[d].holidayInfo || null
                  } : null;
                }
                return {
                  employee_id: m.employeeCode,
                  employeeCode: m.employeeCode,
                  name: m.employeeName,
                  department: m.department || 'General',
                  days: daysMap,
                  details: detailsMap
                };
              })
            };

            const upsertQuery = `
              INSERT INTO report_snapshots (month, year, report_data, attendance_matrix, absent_table, holiday_table, generated_by, generated_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (month, year) 
              DO UPDATE SET 
                report_data = EXCLUDED.report_data,
                attendance_matrix = EXCLUDED.attendance_matrix,
                absent_table = EXCLUDED.absent_table,
                holiday_table = EXCLUDED.holiday_table,
                generated_by = EXCLUDED.generated_by,
                updated_at = CURRENT_TIMESTAMP
            `;
            await pool.query(upsertQuery, [
              month, year,
              JSON.stringify(summaryRows),
              JSON.stringify(dailyAttendanceMatrix),
              JSON.stringify(absentTable || []),
              JSON.stringify(holidayTable || []),
              adminId
            ]);
          } catch (snapErr) {
            console.error('Failed to save report snapshot in bot command:', snapErr);
          }

          if (query) {
            const qLower = query.toLowerCase();
            const exactMatches = summaryRows.filter(r =>
              String(r.employeeCode || '').toLowerCase() === qLower ||
              String(r.employeeName || '').toLowerCase() === qLower
            );
            const matched = exactMatches.length === 1 ? exactMatches : summaryRows.filter(r =>
              String(r.employeeCode || '').toLowerCase().includes(qLower) ||
              String(r.employeeName || '').toLowerCase().includes(qLower)
            );

            if (matched.length === 0) {
              return res.json({
                success: false,
                message: `No employee found matching "${query}". Please check the name or employee ID.`
              });
            }

            if (matched.length > 1) {
              return res.json({
                success: true,
                type: 'multiple_employees_found',
                message: `I found multiple employees matching "${query}":`,
                data: matched.map(m => ({
                  id: m.employeeId,
                  employeeCode: m.employeeCode,
                  name: m.employeeName,
                  department: m.department
                })),
                month,
                year
              });
            }

            const empReport = matched[0];

            await logAdminActivity({
              adminId, adminName, adminEmail,
              actionType: 'GENERATE REPORT SUMMARY',
              moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
              description: `Generated report summary for ${empReport.employeeCode} - ${empReport.employeeName} for ${monthName} ${year} using Admin Assistant.`,
              ipAddress, browserInfo,
              source: 'ADMIN_ASSISTANT'
            });

            return res.json({
              success: true,
              type: 'report_summary_single',
              message: `Report Details - ${empReport.employeeName}\nMonth: ${monthName} ${year}`,
              data: {
                month,
                year,
                monthName,
                employee: empReport
              }
            });
          }

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'GENERATE REPORT SUMMARY',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Generated report summary for ${monthName} ${year} (${summaryRows.length} employees) using Admin Assistant.`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'report_summary_all',
            message: `Report Summary - ${monthName} ${year}`,
            data: {
              month,
              year,
              monthName,
              totalEmployees: summaryRows.length,
              employees: summaryRows
            }
          });

        } catch (dbErr) {
          console.error('Report summary error:', dbErr);
          return res.json({
            success: false,
            message: 'I could not generate the report summary right now. Please try again.'
          });
        }
      }

      case 'calculate_payroll': {
        if (!checkPermission(req, 'payroll', 'can_calculate')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to calculate payroll.'
          });
        }

        const { month, year } = payload || {};
        if (!month || !year) {
          return res.status(400).json({
            success: false,
            message: 'Month and year are required to calculate payroll.'
          });
        }

        try {
          const calculatedRecords = await buildMonthlyPayroll(month, year);

          for (const pr of calculatedRecords) {
            await pool.query(
              `INSERT INTO payroll_records (
                employee_id, employee_code, payroll_month, payroll_year, 
                present_days, late_days, absent_days, blank_unmarked_days, holiday_days,
                total_days, working_days, paid_days, half_days, half_day_loss_amount,
                monthly_earning, per_day_salary, lop_days, lop_amount, net_earning,
                basic_salary, hra, special_allowance, staff_advance, professional_tax, tds, net_payable, status, is_manual_edited
              ) VALUES (
                $1, $2, $3, $4, 
                $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19,
                $20, $21, $22, $23, $24, $25, $26, $27, $28
              )
              ON CONFLICT (employee_id, payroll_month, payroll_year) DO UPDATE SET
                present_days = EXCLUDED.present_days,
                late_days = EXCLUDED.late_days,
                absent_days = EXCLUDED.absent_days,
                blank_unmarked_days = EXCLUDED.blank_unmarked_days,
                holiday_days = EXCLUDED.holiday_days,
                total_days = EXCLUDED.total_days,
                working_days = EXCLUDED.working_days,
                paid_days = EXCLUDED.paid_days,
                half_days = EXCLUDED.half_days,
                half_day_loss_amount = EXCLUDED.half_day_loss_amount,
                monthly_earning = EXCLUDED.monthly_earning,
                per_day_salary = EXCLUDED.per_day_salary,
                lop_days = EXCLUDED.lop_days,
                lop_amount = EXCLUDED.lop_amount,
                net_earning = EXCLUDED.net_earning,
                basic_salary = EXCLUDED.basic_salary,
                hra = EXCLUDED.hra,
                special_allowance = EXCLUDED.special_allowance,
                staff_advance = EXCLUDED.staff_advance,
                professional_tax = EXCLUDED.professional_tax,
                tds = EXCLUDED.tds,
                net_payable = EXCLUDED.net_payable,
                status = EXCLUDED.status,
                is_manual_edited = EXCLUDED.is_manual_edited,
                updated_at = CURRENT_TIMESTAMP`,
              [
                pr.employeeCode, pr.employeeCode, month, year,
                pr.presentDays, pr.lateDays, pr.absentDays, pr.blankUnmarkedDays, pr.holidayDays,
                pr.totalDays, pr.workingDays, pr.paidDays, pr.halfDays, pr.halfDayLossAmount,
                pr.monthlyEarning, pr.perDaySalary, pr.lopDays, pr.lopAmount, pr.netEarning,
                pr.basicSalary, pr.hra, pr.specialAllowance, pr.staffAdvance, pr.professionalTax, pr.tds, pr.netPayable, pr.status || 'pending', pr.is_manual_edited || false
              ]
            );
          }

          let totalNetPayable = 0;
          calculatedRecords.forEach(r => { totalNetPayable += parseFloat(r.netPayable) || 0; });

          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const monthName = monthNames[parseInt(month) - 1] || month;

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'CALCULATE PAYROLL',
            moduleName: MODULE_NAMES.PAYROLL || 'Payroll',
            description: `Calculated payroll for ${monthName} ${year}. Total employees: ${calculatedRecords.length}. Total payable: ₹${totalNetPayable.toLocaleString('en-IN')}.`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'calculate_payroll',
            message: `Payroll calculated successfully for ${monthName} ${year}.\nEmployees processed: ${calculatedRecords.length}\nTotal Net Payable: ₹${totalNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            data: {
              month, year, monthName,
              processedCount: calculatedRecords.length,
              totalNetPayable
            }
          });
        } catch (dbErr) {
          console.error('Calculate payroll error:', dbErr);
          return res.json({
            success: false,
            message: `Payroll calculation failed: ${dbErr.message || 'Server error'}`
          });
        }
      }

      case 'add_manual_attendance': {
        if (!checkPermission(req, 'manual_attendance', 'can_create') && !checkPermission(req, 'manual_attendance', 'can_edit')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to add manual attendance.'
          });
        }

        const { employeeCode, date, checkInTime, checkOutTime, reason } = payload || {};
        if (!employeeCode || !date || !checkInTime || !reason) {
          return res.json({
            success: false,
            message: 'Please provide employee ID, date, check-in time, and reason.'
          });
        }

        try {
          const empCheck = await pool.query("SELECT employee_id, name FROM employees WHERE employee_id = $1 OR id::text = $1", [employeeCode]);
          if (empCheck.rows.length === 0) {
            return res.json({
              success: false,
              message: `Employee "${employeeCode}" not found. Please verify employee ID.`
            });
          }

          const realEmpCode = empCheck.rows[0].employee_id;
          const empName = empCheck.rows[0].name;

          await pool.query(
            `INSERT INTO attendance (employee_id, attendance_date, login_time, logout_time, attendance_status, absent_reason)
             VALUES ($1, $2, $3, $4, 'Present', $5)
             ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
               login_time = EXCLUDED.login_time,
               logout_time = COALESCE(EXCLUDED.logout_time, attendance.logout_time),
               attendance_status = 'Present',
               absent_reason = EXCLUDED.absent_reason,
               updated_at = CURRENT_TIMESTAMP`,
            [realEmpCode, date, checkInTime, checkOutTime || null, reason]
          );

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'MANUAL ATTENDANCE ADDED',
            moduleName: MODULE_NAMES.MANUAL_ATTENDANCE || 'Manual Attendance',
            description: `Added manual attendance for ${empName} (${realEmpCode}) on ${date} (In: ${checkInTime}). Reason: ${reason}`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'add_manual_attendance',
            message: `Manual attendance saved successfully for ${empName} (${realEmpCode}) on ${date}.`
          });
        } catch (dbErr) {
          console.error('Manual attendance error:', dbErr);
          return res.json({
            success: false,
            message: 'I could not save manual attendance right now. Please verify employee details.'
          });
        }
      }

      case 'mark_today_attendance': {
        if (!checkPermission(req, 'manual_attendance', 'can_create') && !checkPermission(req, 'manual_attendance', 'can_edit')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to mark attendance.'
          });
        }

        const { employeeCode } = payload || {};
        if (!employeeCode) {
          return res.json({ success: false, message: 'Please specify an employee ID or name.' });
        }

        try {
          const resCheckIn = await quickCheckInEmployee({
            employeeId: employeeCode,
            adminId,
            adminName,
            adminEmail,
            ipAddress,
            userAgent: browserInfo,
            reasonSource: 'Admin Assistant Bot check-in'
          });

          const time12Str = formatTime12Hour(resCheckIn.loginTime);

          return res.json({
            success: true,
            type: 'mark_today_attendance',
            message: `Attendance marked successfully.\nEmployee: ${resCheckIn.employeeCode} - ${resCheckIn.employeeName}\nCheck-in: ${time12Str}\nStatus: ${resCheckIn.attendanceStatus}${resCheckIn.lateMinutes > 0 ? `\nLate: ${resCheckIn.lateMinutes} min` : ''}`
          });
        } catch (dbErr) {
          console.error('Mark today attendance error:', dbErr);
          return res.json({
            success: false,
            message: dbErr.message || 'I could not mark attendance right now. Please try again.'
          });
        }
      }

      case 'mark_today_checkout': {
        if (!checkPermission(req, 'manual_attendance', 'can_create') && !checkPermission(req, 'manual_attendance', 'can_edit')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to mark check-out.'
          });
        }

        const { employeeCode } = payload || {};
        if (!employeeCode) {
          return res.json({ success: false, message: 'Please specify an employee ID or name.' });
        }

        try {
          const resCheckOut = await quickCheckOutEmployee({
            employeeId: employeeCode,
            adminId,
            adminName,
            adminEmail,
            ipAddress,
            userAgent: browserInfo,
            reasonSource: 'Admin Assistant Bot check-out'
          });

          const time12Str = formatTime12Hour(resCheckOut.logoutTime);
          const hrsInt = Math.floor(resCheckOut.totalMinutes / 60);
          const minsInt = resCheckOut.totalMinutes % 60;
          const formattedTotalStr = `${hrsInt}h ${minsInt}m`;

          return res.json({
            success: true,
            type: 'mark_today_checkout',
            message: `Check-out marked successfully.\nEmployee: ${resCheckOut.employeeCode} - ${resCheckOut.employeeName}\nCheck-out: ${time12Str}\nTotal Hours: ${formattedTotalStr}\nStatus: ${resCheckOut.attendanceStatus}`
          });
        } catch (dbErr) {
          console.error('Mark today check-out error:', dbErr);
          return res.json({
            success: false,
            message: dbErr.message || 'I could not mark check-out right now. Please try again.'
          });
        }
      }

      case 'checkout_all_employees': {
        if (!checkPermission(req, 'manual_attendance', 'can_create') && !checkPermission(req, 'manual_attendance', 'can_edit')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to mark check-out for all employees.'
          });
        }

        try {
          const requestedDate = payload?.attendanceDate || payload?.date;
          const resAll = await checkOutAllEmployees({
            attendanceDate: requestedDate,
            adminId,
            adminName,
            adminEmail,
            ipAddress,
            userAgent: browserInfo
          });

          if (!resAll.summary || resAll.summary.totalTargeted === 0) {
            return res.json({
              success: true,
              type: 'checkout_all_employees',
              message: resAll.message || 'No employees are currently pending check-out today.'
            });
          }

          let msg = `${resAll.message}\n\nSummary:\nSuccess: ${resAll.summary.successCount}\nSkipped: ${resAll.summary.skippedCount}\nFailed: ${resAll.summary.failedCount}`;

          if (resAll.details?.successes && resAll.details.successes.length > 0) {
            msg += '\n\nDetails:\n' + resAll.details.successes.map(s => `✓ ${s.employeeCode} - ${s.name} - ${s.totalHoursStr} - ${s.attendanceStatus}`).join('\n');
          }

          if (resAll.details?.skipped && resAll.details.skipped.length > 0) {
            msg += '\n\nSkipped:\n' + resAll.details.skipped.slice(0, 5).map(sk => `- ${sk.employeeCode} - ${sk.reason}`).join('\n');
            if (resAll.details.skipped.length > 5) {
              msg += `\n+ ${resAll.details.skipped.length - 5} more`;
            }
          }

          return res.json({
            success: true,
            type: 'checkout_all_employees',
            message: msg,
            data: resAll
          });
        } catch (dbErr) {
          console.error('Checkout all employees error:', dbErr);
          return res.json({
            success: false,
            message: dbErr.message || 'I could not mark check-out for all employees right now.'
          });
        }
      }

      case 'mark_today_absent': {
        if (!checkPermission(req, 'manual_attendance', 'can_create') && !checkPermission(req, 'manual_attendance', 'can_edit')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to mark attendance.'
          });
        }

        const { employeeCode, reason } = payload || {};
        if (!employeeCode) {
          return res.json({ success: false, message: 'Please specify an employee ID or name.' });
        }

        try {
          const targetDateStr = getIndiaDateTime().split('T')[0];
          const blockedCheck = await getAttendanceBlockedReason(targetDateStr, 'mark absent');
          if (blockedCheck.blocked) {
            return res.json({
              success: false,
              message: blockedCheck.message
            });
          }

          const empCheck = await pool.query('SELECT employee_id, name FROM employees WHERE employee_id = $1 OR id::text = $1', [employeeCode]);
          if (empCheck.rows.length === 0) {
            return res.json({ success: false, message: `Employee "${employeeCode}" not found.` });
          }

          const realEmpCode = empCheck.rows[0].employee_id;
          const empName = empCheck.rows[0].name;

          const attCheck = await pool.query('SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = CURRENT_DATE', [realEmpCode]);
          const existing = attCheck.rows[0];

          if (existing && (existing.login_time || ['Present', 'Late', 'Half Day'].includes(existing.attendance_status))) {
            return res.json({
              success: false,
              message: 'This employee already has attendance for today. Please edit from Manual Attendance page.'
            });
          }

          const todayDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          let newId = existing?.id;

          if (existing) {
            await pool.query(
              `UPDATE attendance SET 
                attendance_status = 'Absent', absent_reason = $1,
                validation_method = 'Manual', total_working_hours = 0, total_hours = 0, total_minutes = 0,
                updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [reason || 'Absent', existing.id]
            );
          } else {
            const ins = await pool.query(
              `INSERT INTO attendance (
                employee_id, attendance_date, attendance_status, absent_reason, validation_method,
                total_working_hours, total_hours, total_minutes
              ) VALUES ($1, CURRENT_DATE, 'Absent', $2, 'Manual', 0, 0, 0) RETURNING id`,
              [realEmpCode, reason || 'Absent']
            );
            newId = ins.rows[0].id;
          }

          const numericAdminId = Number.isInteger(Number(adminId)) ? Number(adminId) : null;
          await pool.query(
            `INSERT INTO manual_attendance_logs (attendance_id, employee_id, attendance_date, action, admin_id, reason)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)`,
            [newId, realEmpCode, 'CREATED', numericAdminId, reason || 'Marked absent via Admin Assistant Bot']
          );

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'MARK ABSENT',
            moduleName: MODULE_NAMES.MANUAL_ATTENDANCE || 'Manual Attendance',
            description: `Marked ${empName} (${realEmpCode}) absent for today (${todayDateStr}). Reason: ${reason || 'Absent'}.`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'mark_today_absent',
            message: `${realEmpCode} - ${empName} marked Absent for today.\nDate: ${todayDateStr}\nReason: ${reason || 'Absent'}`
          });
        } catch (dbErr) {
          console.error('Mark today absent error:', dbErr);
          return res.json({
            success: false,
            message: 'I could not mark absent right now. Please try again.'
          });
        }
      }

      case 'create_holiday': {
        if (!checkPermission(req, 'holidays', 'can_create')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to create holidays.'
          });
        }

        const { holidayTitle, holidayDate, holidayType } = payload || {};
        if (!holidayTitle || !holidayDate) {
          return res.json({ success: false, message: 'Holiday title and date are required.' });
        }

        try {
          const d = new Date(holidayDate);
          if (isNaN(d.getTime())) {
            return res.json({ success: false, message: 'Invalid holiday date format.' });
          }

          if (d.getDay() === 0) {
            return res.json({ success: false, message: 'Cannot create holiday on Sunday. Sundays are automatically treated as holidays.' });
          }

          const existing = await pool.query('SELECT * FROM holidays WHERE holiday_date = $1', [holidayDate]);
          if (existing.rows.length > 0) {
            return res.json({ success: false, message: 'Holiday already exists for this date.' });
          }

          const typeToSave = holidayType || 'Office Holiday';
          await pool.query(
            `INSERT INTO holidays (holiday_date, holiday_type, holiday_title, is_enabled, created_by)
             VALUES ($1, $2, $3, true, $4)`,
            [holidayDate, typeToSave, holidayTitle, adminId]
          );

          const formattedDateStr = new Date(holidayDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'CREATE HOLIDAY',
            moduleName: MODULE_NAMES.HOLIDAY || 'Holiday',
            description: `Created holiday: ${holidayTitle} on ${holidayDate}`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'create_holiday',
            message: `Holiday created successfully.\nName: ${holidayTitle}\nDate: ${formattedDateStr}`
          });
        } catch (dbErr) {
          console.error('Create holiday error:', dbErr);
          return res.json({
            success: false,
            message: 'I could not create holiday right now. Please try again.'
          });
        }
      }

      case 'search_holiday': {
        if (!checkPermission(req, 'holidays', 'can_view')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view holidays.'
          });
        }

        const { query, date } = payload || {};
        try {
          let sql = "SELECT id, TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date, holiday_title, holiday_type FROM holidays WHERE 1=1";
          const params = [];

          if (date) {
            params.push(date);
            sql += ` AND holiday_date = $${params.length}`;
          }
          if (query) {
            params.push(`%${query}%`);
            sql += ` AND holiday_title ILIKE $${params.length}`;
          }

          sql += " ORDER BY holiday_date ASC";

          const result = await pool.query(sql, params);
          return res.json({
            success: true,
            type: 'search_holiday',
            data: result.rows
          });
        } catch (dbErr) {
          console.error('Search holiday error:', dbErr);
          return res.json({
            success: false,
            message: 'Error searching holidays.'
          });
        }
      }

      case 'delete_holiday': {
        if (!checkPermission(req, 'holidays', 'can_delete')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to delete holidays.'
          });
        }

        const { holidayId, query, date } = payload || {};
        try {
          let targetHoliday;

          if (holidayId) {
            const hRes = await pool.query("SELECT id, TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date, holiday_title, holiday_type FROM holidays WHERE id = $1", [holidayId]);
            targetHoliday = hRes.rows[0];
          } else {
            let sql = "SELECT id, TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date, holiday_title, holiday_type FROM holidays WHERE 1=1";
            const params = [];
            if (date) {
              params.push(date);
              sql += ` AND holiday_date = $${params.length}`;
            }
            if (query) {
              params.push(`%${query}%`);
              sql += ` AND holiday_title ILIKE $${params.length}`;
            }
            const hRes = await pool.query(sql, params);
            if (hRes.rows.length === 0) {
              const notFoundMsg = date ? `No holiday found for ${date}.` : (query ? `No holiday found matching "${query}".` : 'No holiday found.');
              return res.json({
                success: false,
                message: notFoundMsg
              });
            } else if (hRes.rows.length > 1) {
              return res.json({
                success: true,
                type: 'multiple_holidays_found',
                message: 'Multiple holidays found. Please select one:',
                data: hRes.rows
              });
            }
            targetHoliday = hRes.rows[0];
          }

          if (!targetHoliday) {
            return res.json({ success: false, message: 'Holiday not found.' });
          }

          await pool.query('DELETE FROM holidays WHERE id = $1', [targetHoliday.id]);

          const formattedDateStr = new Date(targetHoliday.holiday_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'DELETE HOLIDAY',
            moduleName: MODULE_NAMES.HOLIDAY || 'Holiday',
            description: `Deleted holiday: ${targetHoliday.holiday_title} (${targetHoliday.holiday_date})`,
            ipAddress, browserInfo,
            source: 'ADMIN_ASSISTANT'
          });

          return res.json({
            success: true,
            type: 'delete_holiday',
            message: `Holiday deleted successfully.\nName: ${targetHoliday.holiday_title}\nDate: ${formattedDateStr}`
          });
        } catch (dbErr) {
          console.error('Delete holiday error:', dbErr);
          return res.json({
            success: false,
            message: 'I could not delete holiday right now. Please try again.'
          });
        }
      }

      case 'get_general_help': {
        return res.json({
          success: true,
          type: 'general_help',
          message: generateGeneralHelpFromJSON()
        });
      }

      case 'get_specific_help': {
        const { query } = payload || {};
        const matched = findMatchingActionInJSON(query);
        if (matched) {
          return res.json({
            success: true,
            type: 'specific_help',
            message: generateSpecificHelpFromJSON(matched),
            actionId: matched.id
          });
        }
        return res.json({
          success: true,
          type: 'unknown_fallback',
          message: commandsConfig.fallback?.unknown || 'I could not find an exact match for that. Please choose one of the options below, or type "help" to see everything I can do.'
        });
      }

      case 'get_developer_info': {
        const devName = commandsConfig.botInfo?.developer || commandsConfig.fallback?.developerResponse || 'Mohamed Mushraf';
        return res.json({
          success: true,
          type: 'developer_info',
          message: `I was developed by ${devName}.`
        });
      }

      case 'get_capabilities': {
        return res.json({
          success: true,
          data: commandsConfig
        });
      }

      default:
        return res.status(400).json({
          success: false,
          message: 'This assistant action is not available. Please refresh the page and try again.'
        });
    }
  } catch (error) {
    console.error('Admin Assistant controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'I could not process this command right now. Please try again.',
      type: 'bot_error'
    });
  }
};

module.exports = {
  handleBotCommand,
  getBotCapabilities
};
