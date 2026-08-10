const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { parseTime, getLocalMinutesFromUTC } = require('../utils/timeUtils');
const { getCalculatedLoanDeductionForEmployee } = require('./loanSchedulerService');
function isSunday(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0;
}

function normalizeAttendanceStatus(status) {
  const s = String(status || '').trim().toLowerCase();

  if (s === 'p' || s === 'present') return 'Present';
  if (s === 'late') return 'Late';
  if (s === 'hd' || s === 'half day' || s === 'half_day' || s === 'halfday') return 'Half Day';
  if (s === 'a' || s === 'absent') return 'Absent';
  if (s === 'wfh' || s === 'work from home' || s === 'work_from_home') return 'Work From Home';
  if (
    s === 'not mention' ||
    s === 'not mentioned' ||
    s === 'not_mention' ||
    s === 'not_mentioned' ||
    s === ''
  ) return 'Not Mention';

  return 'Not Mention';
}

function getFinalAttendanceCode(record, isSun, isGovH, isOffH) {
  if (isSun) return 'S';
  if (isOffH) return 'OH';
  if (isGovH) return 'GH';

  if (!record) return '-';

  const status = normalizeAttendanceStatus(record.attendance_status || record.status);

  if (status === 'Present') return 'P';
  if (status === 'Late') return 'L';
  if (status === 'Half Day') return 'HD';
  if (status === 'Absent') return 'A';
  if (status === 'Work From Home') return 'P';
  if (status === 'Not Mention') return '-';

  return '-';
}

function getWorkedMinutes(att, officeStartTimeMins = null) {
  if (att.login_time && att.logout_time) {
    const login = new Date(att.login_time);
    const logout = new Date(att.logout_time);
    
    let effectiveLogin = login;
    if (officeStartTimeMins !== null) {
      const loginMins = getLocalMinutesFromUTC(att.login_time);
      if (loginMins < officeStartTimeMins) {
        effectiveLogin = new Date(effectiveLogin.getTime() + (officeStartTimeMins - loginMins) * 60000);
      }
    }
    
    const diff = (logout - effectiveLogin) / 60000;
    if (Number.isFinite(diff) && diff > 0) {
      return Math.round(diff);
    }
  }

  // Fallback to saved hours if raw time isn't calculable
  const totalWorkingHours = Number(att.total_working_hours || 0);
  if (Number.isFinite(totalWorkingHours) && totalWorkingHours > 0) {
    return Math.round(totalWorkingHours * 60);
  }

  const totalMinutes = Number(att.total_minutes || 0);
  if (Number.isFinite(totalMinutes) && totalMinutes > 0) {
    return totalMinutes;
  }

  const totalHours = Number(att.total_hours || 0);
  if (Number.isFinite(totalHours) && totalHours > 0) {
    return Math.round(totalHours * 60);
  }

  const workingHours = Number(att.working_hours || 0);
  if (Number.isFinite(workingHours) && workingHours > 0) {
    return Math.round(workingHours * 60);
  }

  return 0;
}

async function buildMonthlyAttendanceMatrixAndSummary(month, year, targetEmployeeId = null) {
  const settings = await getSettingsFromDB();
  const officeLateTimeInMinutes = parseTime(settings.workingHours.lateAfterTime);
  const officeStartTimeMins = parseTime(settings.workingHours.officeStartTime || settings.workingHours.start_time || '09:30 AM');

  // Shift Settings
  const shiftSettings = settings.shiftSettings || {};
  const morningShiftStart = parseTime(shiftSettings.morningShiftStartTime || '09:30');
  const morningLateAfter = parseTime(shiftSettings.morningLateAfterTime || '09:45');
  const morningShiftEnd = parseTime(shiftSettings.morningShiftEndTime || '13:30');
  const lunchStart = parseTime(shiftSettings.lunchStartTime || '13:30');
  const lunchEnd = parseTime(shiftSettings.lunchEndTime || '14:00');
  const eveningShiftStart = parseTime(shiftSettings.eveningShiftStartTime || '14:00');
  const eveningLateAfter = parseTime(shiftSettings.eveningLateAfterTime || '14:00');
  const eveningShiftEnd = parseTime(shiftSettings.eveningShiftEndTime || '17:30');

  let employeesQuery = `
     SELECT e.id, e.employee_id as "employeeCode", e.name as "employeeName", d.name as department,
            e.monthly_salary, e.basic_salary, e.hra, e.special_allowance, e.staff_advance, e.professional_tax, e.tds
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE e.status = 'active' OR e.status = 'Active'
  `;
  const queryParams = [];

  if (targetEmployeeId) {
    employeesQuery += ` AND (e.id::text = $1 OR e.employee_id = $1)`;
    queryParams.push(String(targetEmployeeId));
  } else {
    employeesQuery += ` ORDER BY e.name ASC`;
  }

  const employeesResult = await pool.query(employeesQuery, queryParams);
  const employees = employeesResult.rows;

  const holidaysResult = await pool.query(
    `SELECT * FROM holidays 
     WHERE EXTRACT(MONTH FROM holiday_date) = $1 AND EXTRACT(YEAR FROM holiday_date) = $2 AND is_enabled = true`,
    [month, year]
  );

  const holidayMap = {};
  holidaysResult.rows.forEach(h => {
    holidayMap[new Date(h.holiday_date).getDate()] = h;
  });

  const matrixRows = [];
  const summaryRows = [];
  const attendanceData = [];

  // Fetch approved permissions for the month
  const permissionsResult = await pool.query(
    `SELECT employee_id, SUM(duration_minutes) as total_duration
     FROM employee_permissions
     WHERE EXTRACT(MONTH FROM permission_date) = $1 
       AND EXTRACT(YEAR FROM permission_date) = $2
       AND status = 'approved'
     GROUP BY employee_id`,
    [month, year]
  );
  
  const permissionsMap = {};
  permissionsResult.rows.forEach(p => {
    permissionsMap[p.employee_id] = parseInt(p.total_duration || 0);
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  
  let maxDay = daysInMonth;
  if (parseInt(year) === currentYear && parseInt(month) === currentMonth) {
    maxDay = currentDay;
  }

  for (const emp of employees) {
    const attendanceResult = await pool.query(
      `SELECT * FROM attendance 
       WHERE (employee_id = $1 OR employee_id = $4)
       AND EXTRACT(MONTH FROM attendance_date) = $2
       AND EXTRACT(YEAR FROM attendance_date) = $3`,
      [emp.employeeCode, month, year, String(emp.id)]
    );

    const attByDate = {};
    attendanceResult.rows.forEach(att => {
      // Add employee details for PDF absent reasons table
      att.name = emp.employeeName;
      att.department = emp.department;
      att.employee_id = emp.employeeCode;
      
      attendanceData.push(att);
      const d = new Date(att.attendance_date).getDate();
      if (!attByDate[d]) attByDate[d] = [];
      attByDate[d].push(att);
    });

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let lateCount = 0;
    let holidayCount = 0;
    let monthlyTotalMinutes = 0;
    let totalLateMinutes = 0;
    let totalCountedLateMinutes = 0;

    const days = {};

    for (let day = 1; day <= daysInMonth; day++) {
      // 1. Check Sunday
      const isSun = isSunday(year, month, day);
      
      // 2. Check Holiday
      const holiday = holidayMap[day];
      const hType = holiday ? String(holiday.holiday_type || holiday.type || '').toLowerCase() : '';
      const isGovH = hType.includes('gov');
      const isOffH = hType.includes('office') || (!isGovH && holiday); // fallback to OH if not gov

      if (isSun || holiday) {
        holidayCount++;
      }

      // 3. Evaluate attendance
      const dateRecords = attByDate[day];
      
      let finalCode = '';
      let finalRecord = null;
      let dailyMinutes = 0;

      if (!dateRecords || dateRecords.length === 0) {
        finalCode = getFinalAttendanceCode(null, isSun, isGovH, isOffH);
      } else {
        // Priority map for multiple records
        let highestPriority = -1;
        const priorityMap = { 'A': 5, 'HD': 4, 'L': 3, 'P': 2, '-': 1, 'S': 0, 'GH': 0, 'OH': 0 };
        
        for (const att of dateRecords) {
           const code = getFinalAttendanceCode(att, isSun, isGovH, isOffH);
           if (priorityMap[code] > highestPriority) {
              highestPriority = priorityMap[code];
              finalCode = code;
              finalRecord = att;
           }

           const mins = getWorkedMinutes(att, officeStartTimeMins);
           dailyMinutes = Math.max(dailyMinutes, mins);

           if (att.login_time || att.late_minutes) {
             const savedLateMins = (att.late_minutes && Number(att.late_minutes) > 0) ? Number(att.late_minutes) : 0;
             const loginMins = att.login_time ? getLocalMinutesFromUTC(att.login_time) : 0;
             const calculatedLateMins = (loginMins > 0 && loginMins > officeLateTimeInMinutes) ? (loginMins - officeLateTimeInMinutes) : 0;
             const effectiveLateMins = Math.max(savedLateMins, calculatedLateMins);
             if (effectiveLateMins > 0) {
               totalLateMinutes += effectiveLateMins;
             }
             
             // Counted Late Time Logic
             const statusStr = String(att.attendance_status || att.status || '').trim().toLowerCase();
             const isAbsentStatus = statusStr === 'a' || statusStr === 'absent' || statusStr === 'not mention' || statusStr === 'not mentioned' || statusStr === 'not_mention' || statusStr === 'not_mentioned' || statusStr === '';
             
             if (!isSun && !isGovH && !isOffH && !isAbsentStatus) {
               let dailyCountedLate = 0;
               if (loginMins < morningShiftEnd) {
                 if (loginMins > morningLateAfter) {
                   dailyCountedLate = loginMins - morningLateAfter;
                 }
               } else if (loginMins >= lunchStart && loginMins <= lunchEnd) {
                 dailyCountedLate = 0;
               } else if (loginMins >= eveningShiftStart) {
                 if (loginMins > eveningLateAfter) {
                   dailyCountedLate = loginMins - eveningLateAfter;
                 }
               }

               if (dailyCountedLate > 0) {
                 totalCountedLateMinutes += dailyCountedLate;
               }
             }
           }
        }
      }

      if (day <= maxDay) {
        days[day] = {
          code: finalCode,
          record: finalRecord || (dateRecords ? dateRecords[0] : null)
        };
      }
      
      // Only count hours if employee actually worked and is not Absent
      if (['P', 'L', 'HD', 'WFH', 'S', 'OH', 'GH'].includes(finalCode)) {
        monthlyTotalMinutes += dailyMinutes;
      }

      // Exact count
      if (finalCode === 'A') absent++;
      else if (finalCode === 'HD') halfDay++;
      else if (finalCode === 'L') lateCount++;
      else if (finalCode === 'P') present++;
    }

    const totalHours = Number((monthlyTotalMinutes / 60).toFixed(1));
    const totalPermissionMinutes = permissionsMap[emp.employeeCode] || 0;
    
    // Legacy mapping (if any frontend uses it still)
    const totalLateAndPermissionMinutes = totalLateMinutes + totalPermissionMinutes;
    
    // New fields
    const totalActualLateMinutes = totalLateMinutes;
    const countedLateAndPermissionMinutes = totalCountedLateMinutes + totalPermissionMinutes;

    matrixRows.push({
      id: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      department: emp.department || 'N/A',
      days
    });

    summaryRows.push({
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      department: emp.department || 'N/A',
      present,
      absent,
      halfDay,
      holiday: holidayCount,
      lateCount,
      totalLateMinutes,
      totalActualLateMinutes,
      totalCountedLateMinutes,
      totalPermissionMinutes,
      totalLateAndPermissionMinutes,
      countedLateAndPermissionMinutes,
      totalHours: parseFloat(totalHours.toFixed(1))
    });
  }

  // Build holidayTable
  const holidayTable = holidaysResult.rows.map(h => {
    let type = h.holiday_type || h.type || '';
    if (type.toLowerCase().includes('gov')) type = 'Government Holiday';
    else type = 'Office Holiday';
    return {
      date: h.holiday_date,
      type: type,
      name: h.holiday_title || h.name || '',
      notes: h.holiday_note || h.notes || ''
    };
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Build absentTable
  const absentTable = attendanceData.filter(att => {
    const status = normalizeAttendanceStatus(att.attendance_status || att.status);
    return status === 'Absent' || att.absent_reason;
  }).map(att => ({
    employeeId: att.employee_id,
    employeeName: att.name,
    date: att.attendance_date,
    reason: att.absent_reason || '-'
  })).sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return a.employeeName.localeCompare(b.employeeName);
  });

  return { matrixRows, summaryRows, holidaysResult, maxDay, attendanceData, employees, holidayTable, absentTable };
}

async function buildMonthlyPayroll(month, year, targetEmployeeId = null) {
  const { matrixRows, employees, maxDay } = await buildMonthlyAttendanceMatrixAndSummary(month, year, targetEmployeeId);
  
  let existingRecordsQuery = `SELECT * FROM payroll_records WHERE payroll_month = $1 AND payroll_year = $2`;
  const existingParams = [month, year];
  if (targetEmployeeId) {
     existingRecordsQuery += ` AND (employee_id::text = $3 OR employee_code::text = $3)`;
     existingParams.push(String(targetEmployeeId));
  }
  const existingResult = await pool.query(existingRecordsQuery, existingParams);
  const existingMap = {};
  existingResult.rows.forEach(r => {
    existingMap[r.employee_id] = r;
    existingMap[r.employee_code] = r;
  });

  const totalDays = new Date(year, month, 0).getDate();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  
  const payrollRecords = [];

  for (let i = 0; i < matrixRows.length; i++) {
    const matrixRow = matrixRows[i];
    const emp = employees[i];
    
    const days = matrixRow.days;
    let fullPaidDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let holidayDays = 0;
    let blankUnmarkedDays = 0;

    const numMonth = parseInt(month, 10);
    const numYear = parseInt(year, 10);

    for (let day = 1; day <= totalDays; day++) {
      const codeData = days[day];
      const code = codeData ? codeData.code || codeData : null;

      if (code === 'S' || code === 'GH' || code === 'OH') {
        holidayDays++;
        fullPaidDays++;
      } else if (code === 'P' || code === 'L' || code === 'Late') {
        fullPaidDays++;
      } else if (code === 'HD') {
        halfDays++;
      } else if (code === 'A') {
        absentDays++;
      } else {
        // Blank unmarked day
        if (numYear < currentYear || (numYear === currentYear && numMonth < currentMonth)) {
          blankUnmarkedDays++;
        } else if (numYear === currentYear && numMonth === currentMonth && day < currentDay) {
          blankUnmarkedDays++;
        }
      }
    }

    let paidDays = fullPaidDays + (halfDays * 0.5);
    let lopDays = absentDays + blankUnmarkedDays + (halfDays * 0.5);
    let workingDays = totalDays;

    let monthlyEarning = parseFloat(emp.monthly_salary) || 0;
    let basicSalary = parseFloat(emp.basic_salary) || 0;
    let hra = parseFloat(emp.hra) || 0;
    let specialAllowance = parseFloat(emp.special_allowance) || 0;
    let staffAdvance = parseFloat(emp.staff_advance) || 0;
    let professionalTax = parseFloat(emp.professional_tax) || 0;
    let tds = parseFloat(emp.tds) || 0;

    const existing = existingMap[emp.employeeCode];

    if (existing) {
      staffAdvance = existing.staff_advance != null ? parseFloat(existing.staff_advance) : staffAdvance;
      professionalTax = existing.professional_tax != null ? parseFloat(existing.professional_tax) : professionalTax;
      tds = existing.tds != null ? parseFloat(existing.tds) : tds;
    }

    const perDaySalary = totalDays > 0 ? (monthlyEarning / totalDays) : 0;
    const halfDayLossAmount = halfDays * 0.5 * perDaySalary;
    const lopAmount = lopDays * perDaySalary;
    const netEarning = monthlyEarning - lopAmount;

    const salaryAvailableBeforeLoan = Math.max(0, netEarning - staffAdvance - professionalTax - tds);

    // Calculate expected or posted loan deduction for employee
    let loanDeduction = 0;
    let loanDeductionStatus = 'Not Applicable';

    const postedTxRes = await pool.query(
      `SELECT * FROM loan_repayment_transactions
       WHERE (employee_id::text = $1 OR employee_id::text = $2)
         AND payroll_month = $3 AND payroll_year = $4
         AND status != 'Reversed'
       ORDER BY id DESC LIMIT 1`,
      [String(emp.employeeCode), String(emp.id), numMonth, numYear]
    );

    if (postedTxRes.rows.length > 0) {
      const tx = postedTxRes.rows[0];
      loanDeduction = (parseInt(tx.actual_deducted_paise) || 0) / 100;
      loanDeductionStatus = tx.status;
    } else {
      const loanInfo = await getCalculatedLoanDeductionForEmployee(emp.employeeCode, month, year, salaryAvailableBeforeLoan);
      loanDeduction = loanInfo.loanDeductionRupees;
      loanDeductionStatus = loanInfo.status;
    }

    const netPayable = Math.max(0, salaryAvailableBeforeLoan - loanDeduction);

    payrollRecords.push({
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      department: emp.department || 'N/A',
      totalDays,
      workingDays: workingDays,
      presentDays: fullPaidDays,
      lateDays: 0,
      absentDays,
      halfDays,
      holidayDays,
      blankUnmarkedDays,
      paidDays: parseFloat(paidDays.toFixed(2)),
      halfDayLossAmount: parseFloat(halfDayLossAmount.toFixed(2)),
      lopDays: parseFloat(lopDays.toFixed(2)),
      monthlyEarning: parseFloat(monthlyEarning.toFixed(2)),
      perDaySalary: parseFloat(perDaySalary.toFixed(2)),
      lopAmount: parseFloat(lopAmount.toFixed(2)),
      netEarning: parseFloat(netEarning.toFixed(2)),
      basicSalary: parseFloat(basicSalary.toFixed(2)),
      hra: parseFloat(hra.toFixed(2)),
      specialAllowance: parseFloat(specialAllowance.toFixed(2)),
      staffAdvance: parseFloat(staffAdvance.toFixed(2)),
      professionalTax: parseFloat(professionalTax.toFixed(2)),
      tds: parseFloat(tds.toFixed(2)),
      loanDeduction: parseFloat(loanDeduction.toFixed(2)),
      loanDeductionStatus,
      netPayable: parseFloat(netPayable.toFixed(2)),
      status: existing && existing.status ? existing.status : "pending",
      is_manual_edited: false
    });
  }

  return payrollRecords;
}

module.exports = { buildMonthlyAttendanceMatrixAndSummary, buildMonthlyPayroll };
