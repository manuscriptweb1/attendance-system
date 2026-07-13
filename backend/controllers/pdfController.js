const pool = require('../config/database');
const { generateMonthlyAttendancePDF, generateAdminLoginLogsPDF } = require('../utils/pdfGenerator');
const { generateMonthlyAttendanceMatrixPDF, generateMonthlyAttendanceMatrixExcel } = require('../utils/attendanceMatrixGenerator');
const { buildMonthlyAttendanceMatrixAndSummary } = require('../services/attendanceReportService');
const fs = require('fs');
const path = require('path');

// Generate monthly attendance matrix PDF
const generateMonthlyMatrixPDF = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    const { matrixRows, holidaysResult, maxDay, attendanceData } = await buildMonthlyAttendanceMatrixAndSummary(month, year);

    if (matrixRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active employees found'
      });
    }

    // Generate PDF Matrix
    const { filePath, fileName } = await generateMonthlyAttendanceMatrixPDF(
      matrixRows,
      month,
      year,
      maxDay,
      holidaysResult.rows,
      attendanceData
    );

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }

      // Delete file after sending
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temp file:', unlinkErr);
        }
      });
    });

  } catch (error) {
    console.error('Generate PDF matrix error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Generate monthly attendance matrix Excel
const generateMonthlyMatrixExcel = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    const { matrixRows, holidaysResult, maxDay, attendanceData } = await buildMonthlyAttendanceMatrixAndSummary(month, year);

    if (matrixRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active employees found'
      });
    }

    // Generate Excel Matrix
    const { filePath, fileName } = await generateMonthlyAttendanceMatrixExcel(
      matrixRows,
      month,
      year,
      maxDay,
      holidaysResult.rows,
      attendanceData
    );

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }

      // Delete file after sending
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temp file:', unlinkErr);
        }
      });
    });

  } catch (error) {
    console.error('Generate Excel matrix error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Generate monthly attendance PDF
const generateMonthlyPDF = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    // Fetch attendance data for the month
    const result = await pool.query(
      `SELECT a.*, 
              e.employee_id, e.name, e.mobile, e.job_role,
              d.name as department
       FROM attendance a
       JOIN employees e ON a.employee_id = e.employee_id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE EXTRACT(MONTH FROM a.attendance_date) = $1 
       AND EXTRACT(YEAR FROM a.attendance_date) = $2
       ORDER BY e.employee_id, a.attendance_date`,
      [month, year]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No attendance records found for this month'
      });
    }

    // Generate PDF
    const { filePath, fileName } = await generateMonthlyAttendancePDF(
      result.rows,
      month,
      year
    );

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }

      // Delete file after sending
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temp file:', unlinkErr);
        }
      });
    });

  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Generate admin login logs PDF
const generateAdminLogsPDF = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        al.id,
        al.admin_id,
        al.username,
        al.login_time,
        al.ip_address,
        al.browser_info,
        al.device_info
      FROM admin_login_logs al
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND al.login_time >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND al.login_time <= $${params.length}`;
    }

    query += ' ORDER BY al.login_time DESC';

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No login logs found for the selected period'
      });
    }

    // Generate PDF
    const { filePath, fileName } = await generateAdminLoginLogsPDF(
      result.rows,
      startDate,
      endDate
    );

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }

      // Delete file after sending
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temp file:', unlinkErr);
        }
      });
    });

  } catch (error) {
    console.error('Generate admin logs PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = { 
  generateMonthlyPDF, 
  generateAdminLogsPDF,
  generateMonthlyMatrixPDF,
  generateMonthlyMatrixExcel
};
