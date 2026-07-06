const pool = require('../config/database');
const exceljs = require('exceljs');
const { buildMonthlyAttendanceMatrixAndSummary } = require('../services/attendanceReportService');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

const getMonthlyAttendanceReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    const { summaryRows, matrixRows, absentTable, holidayTable } = await buildMonthlyAttendanceMatrixAndSummary(month, year);
    
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    const dailyAttendanceMatrix = {
      days,
      employees: matrixRows.map(m => {
        const daysMap = {};
        for (let d = 1; d <= daysInMonth; d++) {
          daysMap[d] = m.days[d] ? m.days[d].code : '-';
        }
        return {
          employee_id: m.employeeCode,
          name: m.employeeName,
          department: m.department,
          days: daysMap
        };
      })
    };

    res.json({ success: true, reports: summaryRows, dailyAttendanceMatrix, absentTable, holidayTable });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getReportSnapshot = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    const result = await pool.query(
      `SELECT * FROM report_snapshots WHERE month = $1 AND year = $2`,
      [month, year]
    );

    if (result.rows.length > 0) {
      const snap = result.rows[0];
      return res.json({
        success: true,
        reports: snap.report_data,
        dailyAttendanceMatrix: snap.attendance_matrix,
        absentTable: snap.absent_table,
        holidayTable: snap.holiday_table,
        generatedAt: snap.generated_at
      });
    }

    res.json({ success: true, notFound: true, message: 'No saved report found.' });
  } catch (error) {
    console.error('Get snapshot error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const generateMonthlyAttendanceReport = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    const { summaryRows, matrixRows, absentTable, holidayTable } = await buildMonthlyAttendanceMatrixAndSummary(month, year);
    
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    const dailyAttendanceMatrix = {
      days,
      employees: matrixRows.map(m => {
        const daysMap = {};
        for (let d = 1; d <= daysInMonth; d++) {
          daysMap[d] = m.days[d] ? m.days[d].code : '-';
        }
        return {
          employee_id: m.employeeCode,
          name: m.employeeName,
          department: m.department,
          days: daysMap
        };
      })
    };

    // Save to DB
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
      RETURNING generated_at
    `;
    const result = await pool.query(upsertQuery, [
      month, year, 
      JSON.stringify(summaryRows), 
      JSON.stringify(dailyAttendanceMatrix),
      JSON.stringify(absentTable),
      JSON.stringify(holidayTable),
      req.user.id
    ]);

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.GENERATE_REPORT || 'GENERATE_REPORT',
      moduleName: MODULE_NAMES.REPORTS || 'Reports',
      description: `Generated/updated report for ${month}/${year}`,
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({ 
      success: true, 
      reports: summaryRows, 
      dailyAttendanceMatrix, 
      absentTable, 
      holidayTable,
      generatedAt: result.rows[0].generated_at 
    });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const exportMonthlyAttendanceReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    const { summaryRows, matrixRows, absentTable, holidayTable } = await buildMonthlyAttendanceMatrixAndSummary(month, year);
    const daysInMonth = new Date(year, month, 0).getDate();

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    const baseColumns = [
      { header: 'Employee Code', key: 'employeeCode', width: 15 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Present', key: 'present', width: 10 },
      { header: 'Absent', key: 'absent', width: 10 },
      { header: 'Half Day', key: 'halfDay', width: 10 },
      { header: 'Holiday', key: 'holiday', width: 10 },
      { header: 'Late Count', key: 'lateCount', width: 12 },
      { header: 'Total Hours', key: 'totalHours', width: 12 }
    ];

    const dayColumns = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dayColumns.push({ header: String(i), key: `day_${i}`, width: 5 });
    }

    worksheet.columns = [...baseColumns, ...dayColumns];

    const rows = summaryRows.map(row => {
      const matrixRow = matrixRows.find(m => m.employeeCode === row.employeeCode);
      const rowData = { ...row };
      if (matrixRow) {
        for (let i = 1; i <= daysInMonth; i++) {
          rowData[`day_${i}`] = matrixRow.days[i] ? matrixRow.days[i].code : '-';
        }
      }
      return rowData;
    });

    worksheet.addRows(rows);

    // Export Absent Sheet
    const absentSheet = workbook.addWorksheet('Absent Details');
    absentSheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Absent Reason', key: 'reason', width: 40 }
    ];
    if (absentTable && absentTable.length > 0) {
      absentSheet.addRows(absentTable.map((a, i) => ({
        sno: i + 1,
        ...a,
        date: new Date(a.date).toLocaleDateString()
      })));
    }

    // Export Holiday Sheet
    const holidaySheet = workbook.addWorksheet('Holiday Details');
    holidaySheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Holiday Date', key: 'date', width: 15 },
      { header: 'Holiday Type', key: 'type', width: 20 },
      { header: 'Holiday Name', key: 'name', width: 30 },
      { header: 'Notes', key: 'notes', width: 40 }
    ];
    if (holidayTable && holidayTable.length > 0) {
      holidaySheet.addRows(holidayTable.map((h, i) => ({
        sno: i + 1,
        ...h,
        date: new Date(h.date).toLocaleDateString()
      })));
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Attendance_Report_${month}_${year}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getMonthlyAttendanceReport,
  getReportSnapshot,
  generateMonthlyAttendanceReport,
  exportMonthlyAttendanceReport
};
