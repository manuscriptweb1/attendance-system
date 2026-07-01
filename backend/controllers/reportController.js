const pool = require('../config/database');
const exceljs = require('exceljs');
const { buildMonthlyAttendanceMatrixAndSummary } = require('../services/attendanceReportService');

const getMonthlyAttendanceReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    const { summaryRows } = await buildMonthlyAttendanceMatrixAndSummary(month, year);
    res.json({ success: true, reports: summaryRows });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const exportMonthlyAttendanceReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    const { summaryRows } = await buildMonthlyAttendanceMatrixAndSummary(month, year);

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    worksheet.columns = [
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

    worksheet.addRows(reportData);

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
  exportMonthlyAttendanceReport
};
