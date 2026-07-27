const pool = require('../config/database');
const { buildMonthlyPayroll } = require('../services/attendanceReportService');
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
          actionType: 'Navigation',
          moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
          description: `Opened ${targetPage || 'page'} (${path}) using Admin Assistant`,
          ipAddress,
          browserInfo
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
               d.name as department_name 
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE e.employee_id ILIKE $1 
                OR e.name ILIKE $1 
                OR LOWER(REPLACE(e.name, ' ', '')) LIKE LOWER(REPLACE($1, ' ', ''))
                OR LOWER(COALESCE(e.email, '')) ILIKE $1 
                OR LOWER(COALESCE(e.mobile, '')) ILIKE $1
             ORDER BY e.name ASC 
             LIMIT 10`,
            [`%${query}%`]
          );

          const employees = searchRes.rows.map(r => ({
            id: r.id,
            employeeCode: r.employee_id,
            name: r.name,
            email: r.email || 'N/A',
            phone: r.mobile || 'N/A',
            designation: r.designation || 'N/A',
            department: r.department_name || 'N/A',
            status: r.status || 'Active'
          }));

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'Employee Search',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Searched employee query "${query}". Found ${employees.length} record(s).`,
            ipAddress, browserInfo
          });

          if (employees.length === 0) {
            return res.json({
              success: true,
              type: 'employee_search',
              message: `No employee found for "${query}".`,
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
        if (!checkPermission(req, 'attendance', 'can_view') && !checkPermission(req, 'reports', 'can_view')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        try {
          // Query today's marked absent records
          const absentRes = await pool.query(
            `SELECT a.employee_id as employee_code, e.name, d.name as department_name
             FROM attendance a
             JOIN employees e ON a.employee_id::text = e.employee_id::text OR a.employee_id::text = e.id::text
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE a.attendance_date = CURRENT_DATE AND LOWER(a.attendance_status) = 'absent'
             ORDER BY e.name ASC`
          );

          // Query active employees with no attendance record for today (Not Mention)
          const notMentionRes = await pool.query(
            `SELECT e.employee_id as employee_code, e.name, d.name as department_name
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE LOWER(e.status) = 'active'
               AND e.employee_id NOT IN (
                 SELECT DISTINCT employee_id FROM attendance WHERE attendance_date = CURRENT_DATE
               )
             ORDER BY e.name ASC`
          );

          const absentList = absentRes.rows.map(r => ({
            employeeCode: r.employee_code,
            name: r.name,
            department: r.department_name || 'N/A'
          }));

          const notMentionList = notMentionRes.rows.map(r => ({
            employeeCode: r.employee_code,
            name: r.name,
            department: r.department_name || 'N/A'
          }));

          const todayDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'Today Absent Query',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Viewed today's absent list (${todayDateStr}). Marked Absent: ${absentList.length}, Not Mention: ${notMentionList.length}.`,
            ipAddress, browserInfo
          });

          return res.json({
            success: true,
            type: 'today_absent',
            message: `Today Absent Employees - ${todayDateStr}`,
            data: {
              absent: absentList,
              notMention: notMentionList,
              dateStr: todayDateStr
            }
          });
        } catch (dbErr) {
          console.error('Today absent DB query error:', dbErr);
          return res.json({
            success: false,
            message: 'I could not fetch today\'s absent list right now. Please try again.'
          });
        }
      }

      case 'today_late': {
        if (!checkPermission(req, 'attendance', 'can_view') && !checkPermission(req, 'reports', 'can_view')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        try {
          const lateRes = await pool.query(
            `SELECT a.employee_id as employee_code, e.name, d.name as department_name, a.login_time, a.total_working_hours
             FROM attendance a
             JOIN employees e ON a.employee_id::text = e.employee_id::text OR a.employee_id::text = e.id::text
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE a.attendance_date = CURRENT_DATE AND LOWER(a.attendance_status) = 'late'
             ORDER BY a.login_time ASC`
          );

          const lateEmployees = lateRes.rows.map(r => ({
            employeeCode: r.employee_code,
            name: r.name,
            department: r.department_name || 'N/A',
            checkInTime: format12HourTime(r.login_time),
            lateMinutes: 10 // Default indicator or derived
          }));

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'Today Late Query',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Viewed today's late list. Total late: ${lateEmployees.length}.`,
            ipAddress, browserInfo
          });

          return res.json({
            success: true,
            type: 'today_late',
            message: `Late Employees Today: ${lateEmployees.length}`,
            data: lateEmployees
          });
        } catch (dbErr) {
          console.error('Today late DB query error:', dbErr);
          return res.json({
            success: false,
            message: 'I could not fetch today\'s late list right now. Please try again.'
          });
        }
      }

      case 'today_summary': {
        if (!checkPermission(req, 'attendance', 'can_view') && !checkPermission(req, 'reports', 'can_view')) {
          return res.status(403).json({
            success: false,
            message: 'Permission Denied: You do not have permission to view attendance reports.'
          });
        }

        try {
          const statsRes = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE COALESCE(a.attendance_status, 'Not Mention') = 'Present') AS present,
               COUNT(*) FILTER (WHERE COALESCE(a.attendance_status, 'Not Mention') = 'Late') AS late,
               COUNT(*) FILTER (WHERE COALESCE(a.attendance_status, 'Not Mention') = 'Absent') AS absent,
               COUNT(*) FILTER (WHERE COALESCE(a.attendance_status, 'Not Mention') = 'Half Day') AS half_day,
               COUNT(*) FILTER (WHERE a.id IS NULL OR a.attendance_status = 'Not Mention') AS not_mention,
               COUNT(*) FILTER (WHERE a.login_time IS NOT NULL AND a.logout_time IS NULL) AS working
             FROM employees e
             LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.attendance_date = CURRENT_DATE
             WHERE e.status = 'Active'`
          );

          const s = statsRes.rows[0] || {};
          const summary = {
            present: parseInt(s.present || 0),
            late: parseInt(s.late || 0),
            absent: parseInt(s.absent || 0),
            halfDay: parseInt(s.half_day || 0),
            working: parseInt(s.working || 0),
            notMention: parseInt(s.not_mention || 0)
          };

          const todayDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'Today Attendance Summary',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Viewed today's attendance summary (${todayDateStr}). Present: ${summary.present}, Late: ${summary.late}, Absent: ${summary.absent}, Working: ${summary.working}.`,
            ipAddress, browserInfo
          });

          return res.json({
            success: true,
            type: 'today_summary',
            message: `Today Attendance Summary - ${todayDateStr}`,
            data: summary
          });
        } catch (dbErr) {
          console.error('Today summary DB query error:', dbErr);
          return res.json({
            success: false,
            message: 'I could not load today\'s attendance summary right now. Please try again.'
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
            actionType: 'Calculate Payroll',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Calculated payroll for ${monthName} ${year}. Total employees: ${calculatedRecords.length}. Total payable: ₹${totalNetPayable.toLocaleString('en-IN')}.`,
            ipAddress, browserInfo
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
            actionType: 'Manual Attendance Added',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Added manual attendance for ${empName} (${realEmpCode}) on ${date} (In: ${checkInTime}). Reason: ${reason}`,
            ipAddress, browserInfo
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
          const resAll = await checkOutAllEmployees({
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

          await pool.query(
            `INSERT INTO manual_attendance_logs (attendance_id, employee_id, attendance_date, action, admin_id, reason)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)`,
            [newId, realEmpCode, 'CREATED', adminId, reason || 'Marked absent via Admin Assistant Bot']
          );

          await logAdminActivity({
            adminId, adminName, adminEmail,
            actionType: 'Mark Absent',
            moduleName: MODULE_NAMES.ADMIN_ASSISTANT,
            description: `Marked ${empName} (${realEmpCode}) absent for today (${todayDateStr}). Reason: ${reason || 'Absent'}.`,
            ipAddress, browserInfo
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
            actionType: ADMIN_ACTION_TYPES.CREATE_HOLIDAY || 'Create Holiday',
            moduleName: MODULE_NAMES.HOLIDAY || 'Holidays',
            description: `Created holiday: ${holidayTitle} on ${holidayDate} via Admin Assistant.`,
            ipAddress, browserInfo
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
            actionType: ADMIN_ACTION_TYPES.DELETE_HOLIDAY || 'Delete Holiday',
            moduleName: MODULE_NAMES.HOLIDAY || 'Holidays',
            description: `Deleted holiday: ${targetHoliday.holiday_title} (${targetHoliday.holiday_date}) via Admin Assistant.`,
            ipAddress, browserInfo
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
          message: commandsConfig.fallback?.unknown || 'I do not know that. Please ask my developer.'
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
          message: commandsConfig.fallback?.unknown || 'Unknown command action.'
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
