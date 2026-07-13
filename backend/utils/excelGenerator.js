const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const generateMonthlyAttendanceExcel = async (attendanceData, month, year) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // Headers
    worksheet.columns = [
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Attendance Date', key: 'date', width: 15 },
      { header: 'Login Time', key: 'login', width: 15 },
      { header: 'Logout Time', key: 'logout', width: 15 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'WFH', key: 'wfh', width: 10 },
      { header: 'Absent Reason', key: 'absent_reason', width: 30 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };

    // Data rows
    attendanceData.forEach(record => {
      worksheet.addRow({
        employee_id: record.employee_id || '-',
        name: record.name || '-',
        department: record.department || '-',
        date: record.attendance_date ? new Date(record.attendance_date).toLocaleDateString() : '-',
        login: record.login_time ? new Date(record.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        logout: record.logout_time ? new Date(record.logout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        hours: record.total_working_hours ? `${record.total_working_hours}h` : '-',
        status: record.attendance_status || '-',
        wfh: record.is_wfh ? 'Yes' : 'No',
        absent_reason: record.absent_reason || '-'
      });
    });

    const fileName = `attendance_report_${month}_${year}_${Date.now()}.xlsx`;
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    return { filePath, fileName };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  generateMonthlyAttendanceExcel
};
