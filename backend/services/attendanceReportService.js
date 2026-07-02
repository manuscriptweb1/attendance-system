const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { parseTime } = require('../utils/timeUtils');

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
  if (isSun) return 'Sun';
  if (isGovH) return 'GovH';
  if (isOffH) return 'OffH';

  if (!record) return '';

  const status = normalizeAttendanceStatus(record.attendance_status || record.status);

  if (status === 'Present') return 'P';
  if (status === 'Late') return 'Late';
  if (status === 'Half Day') return 'HD';
  if (status === 'Absent') return 'A';
  if (status === 'Work From Home') return 'WFH';
  if (status === 'Not Mention') return '';

  return '';
}

function getWorkedMinutes(att) {
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

  if (att.login_time && att.logout_time) {
    const login = new Date(att.login_time);
    const logout = new Date(att.logout_time);
    const diff = (logout - login) / 60000;
    if (Number.isFinite(diff) && diff > 0) {
      return Math.round(diff);
    }
  }

  return 0;
}

async function buildMonthlyAttendanceMatrixAndSummary(month, year) {
  const settings = await getSettingsFromDB();
  const officeLateTimeInMinutes = parseTime(settings.workingHours.lateAfterTime);

  const employeesResult = await pool.query(
    `SELECT e.id, e.employee_id as "employeeCode", e.name as "employeeName", d.name as department,
            e.monthly_salary, e.basic_salary, e.hra, e.special_allowance, e.staff_advance, e.professional_tax, e.tds
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE e.status = 'active' OR e.status = 'Active'
     ORDER BY e.name ASC`
  );

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

    const days = {};

    for (let day = 1; day <= daysInMonth; day++) {
      // 1. Check Sunday
      const isSun = isSunday(year, month, day);
      
      // 2. Check Holiday
      const holiday = holidayMap[day];
      const isGovH = holiday && holiday.holiday_type === 'Government Holiday';
      const isOffH = holiday && holiday.holiday_type === 'Office Holiday';

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
        // Priority map for multiple records (Absent > HD > Late > P > WFH > empty > Sun > GovH > OffH)
        let highestPriority = -1;
        const priorityMap = { 'A': 5, 'HD': 4, 'Late': 3, 'P': 2, 'WFH': 2, '': 1, 'Sun': 0, 'GovH': 0, 'OffH': 0 };
        
        for (const att of dateRecords) {
           const code = getFinalAttendanceCode(att, isSun, isGovH, isOffH);
           if (priorityMap[code] > highestPriority) {
              highestPriority = priorityMap[code];
              finalCode = code;
              finalRecord = att;
           }

           const mins = getWorkedMinutes(att);
           dailyMinutes = Math.max(dailyMinutes, mins);
        }
      }

      if (day <= maxDay) {
        days[day] = {
          code: finalCode,
          record: finalRecord || (dateRecords ? dateRecords[0] : null)
        };
      }
      
      // Only count hours if employee actually worked
      if (['P', 'Late', 'HD', 'WFH'].includes(finalCode)) {
        monthlyTotalMinutes += dailyMinutes;
      }

      // Exact count
      if (finalCode === 'A') absent++;
      else if (finalCode === 'HD') halfDay++;
      else if (finalCode === 'Late') lateCount++;
      else if (finalCode === 'P' || finalCode === 'WFH') present++;
    }

    const totalHours = Number((monthlyTotalMinutes / 60).toFixed(1));

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
      totalHours: parseFloat(totalHours.toFixed(1))
    });
  }

  return { matrixRows, summaryRows, holidaysResult, maxDay, attendanceData, employees };
}

async function buildMonthlyPayroll(month, year) {
  const { matrixRows, employees, maxDay } = await buildMonthlyAttendanceMatrixAndSummary(month, year);
  
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

      if (code === 'Sun' || code === 'GovH' || code === 'OffH') {
        holidayDays++;
        fullPaidDays++;
      } else if (code === 'P' || code === 'Late') {
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

    const paidDays = fullPaidDays + (halfDays * 0.5);
    const lopDays = absentDays + blankUnmarkedDays + (halfDays * 0.5);

    const monthlyEarning = parseFloat(emp.monthly_salary) || 0;
    const perDaySalary = totalDays > 0 ? (monthlyEarning / totalDays) : 0;
    const halfDayLossAmount = halfDays * 0.5 * perDaySalary;
    const lopAmount = lopDays * perDaySalary;
    const netEarning = monthlyEarning - lopAmount;

    const basicSalary = parseFloat(emp.basic_salary) || 0;
    const hra = parseFloat(emp.hra) || 0;
    const specialAllowance = parseFloat(emp.special_allowance) || 0;
    const staffAdvance = parseFloat(emp.staff_advance) || 0;
    const professionalTax = parseFloat(emp.professional_tax) || 0;
    const tds = parseFloat(emp.tds) || 0;

    const netPayable = netEarning - staffAdvance - professionalTax - tds;

    payrollRecords.push({
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      department: emp.department || 'N/A',
      totalDays,
      workingDays: totalDays, // user rule 2: same as total_days
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
      netPayable: parseFloat(netPayable.toFixed(2)),
      status: "pending"
    });
  }

  return payrollRecords;
}

module.exports = { buildMonthlyAttendanceMatrixAndSummary, buildMonthlyPayroll };
