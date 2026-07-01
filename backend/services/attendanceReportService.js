const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { parseTime } = require('../utils/timeUtils');

function isSunday(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0;
}

function getAttendanceCodeFromDB(record) {
  if (!record.login_time && record.attendance_status === 'Absent') return 'A';
  if (!record.login_time) return null;
  const status = record.attendance_status;
  if (status === 'Late') return 'Late';
  if (status === 'Half Day') return 'HD';
  if (status === 'Present' || status === 'Work From Home') return 'P';
  if (status === 'Absent') return 'A';
  return null;
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
    let totalHours = 0;

    const days = {};

    for (let day = 1; day <= daysInMonth; day++) {
      // 1. Check Sunday
      if (isSunday(year, month, day)) {
        if (day <= maxDay) days[day] = 'Sun';
        holidayCount++;
        continue;
      }
      
      // 2. Check Holiday
      const holiday = holidayMap[day];
      if (holiday) {
        const type = holiday.holiday_type === 'Government Holiday' ? 'GovH' : 'OffH';
        if (day <= maxDay) days[day] = type;
        holidayCount++;
        continue;
      }

      // 3. Evaluate attendance
      const dateRecords = attByDate[day];
      if (!dateRecords || dateRecords.length === 0) {
        if (day <= maxDay) days[day] = '';
        continue;
      }

      // Priority: Absent > Half Day > Late > Present
      let finalCode = 'P';
      let hasA = false;
      let hasHD = false;
      let hasLate = false;
      let hasP = false;
      
      let maxHours = 0;

      for (const att of dateRecords) {
        const code = getAttendanceCodeFromDB(att);
        if (code === 'A') hasA = true;
        if (code === 'HD') hasHD = true;
        if (code === 'Late') hasLate = true;
        if (code === 'P') hasP = true;

        if (att.checkin_status === 'late' || att.late_minutes > 0) {
          hasLate = true;
        } else if (!att.checkin_status && att.login_time) {
          const loginDate = new Date(att.login_time);
          const localLoginMinutes = (loginDate.getUTCHours() * 60 + loginDate.getUTCMinutes() + (5.5 * 60)) % (24 * 60);
          if (localLoginMinutes > officeLateTimeInMinutes) {
             hasLate = true;
          }
        }

        let hours = 0;
        if (att.total_hours) {
           hours = parseFloat(att.total_hours);
        } else if (att.total_minutes) {
           hours = parseFloat(att.total_minutes) / 60;
        } else if (att.total_working_hours) {
           hours = parseFloat(att.total_working_hours);
        } else if (att.login_time && att.logout_time) {
           hours = (new Date(att.logout_time) - new Date(att.login_time)) / 3600000;
        }
        maxHours = Math.max(maxHours, hours);
      }

      if (hasA && !hasP && !hasHD && !hasLate) {
        finalCode = 'A';
      } else if (hasHD) {
        finalCode = 'HD';
      } else if (hasLate) {
        finalCode = 'Late';
      } else if (hasP) {
        finalCode = 'P';
      } else if (hasA) {
        finalCode = 'A';
      } else {
        finalCode = '';
      }

      if (day <= maxDay) {
        // Find the record that gave the finalCode to pass its metadata
        let finalRecord = null;
        if (finalCode === 'A') finalRecord = dateRecords.find(a => getAttendanceCodeFromDB(a) === 'A');
        else if (finalCode === 'HD') finalRecord = dateRecords.find(a => getAttendanceCodeFromDB(a) === 'HD');
        else if (finalCode === 'Late') finalRecord = dateRecords.find(a => getAttendanceCodeFromDB(a) === 'Late' || a.checkin_status === 'late' || a.late_minutes > 0);
        else if (finalCode === 'P') finalRecord = dateRecords.find(a => getAttendanceCodeFromDB(a) === 'P');

        days[day] = {
          code: finalCode,
          record: finalRecord || dateRecords[0]
        };
      }
      
      totalHours += maxHours;

      // Exact count
      if (finalCode === 'A') absent++;
      else if (finalCode === 'HD') halfDay++;
      else if (finalCode === 'Late') lateCount++;
      else if (finalCode === 'P') present++;
    }

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
