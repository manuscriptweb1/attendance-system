const pool = require('../config/database');
const { buildMonthlyAttendanceMatrixAndSummary } = require('../services/attendanceReportService');

/**
 * @desc    Get public attendance matrix
 * @route   GET /api/public/attendance-matrix
 * @access  Public
 */
const getPublicAttendanceMatrix = async (req, res) => {
  try {
    const today = new Date();
    const month = parseInt(req.query.month) || today.getMonth() + 1;
    const year = parseInt(req.query.year) || today.getFullYear();

    // buildMonthlyAttendanceMatrixAndSummary returns an object containing dailyAttendanceMatrix
    const result = await buildMonthlyAttendanceMatrixAndSummary(month, year);
    
    // Check if the current requested month/year is exactly the current month/year
    const isCurrentMonth = (month === today.getMonth() + 1) && (year === today.getFullYear());
    const currentDay = today.getDate();

    // Map result.matrixRows to the safe public format
    const employees = result.matrixRows.map(emp => {
      const attendance = {};
      
      for (const day in emp.days) {
        const dayNum = parseInt(day);
        
        // If viewing current month, days after today should be blank ('-')
        if (isCurrentMonth && dayNum > currentDay) {
          attendance[dayNum] = '-';
        } else {
          attendance[dayNum] = emp.days[dayNum].code || '-';
        }
      }
      
      return {
        employee_id: emp.employeeCode,
        employee_name: emp.employeeName,
        department: emp.department,
        attendance
      };
    });

    res.json({
      success: true,
      month,
      year,
      employees,
      legend: {
        "P": "Present",
        "A": "Absent",
        "HD": "Half Day",
        "L": "Late",
        "S": "Sunday",
        "OH": "Office Holiday",
        "GH": "Government Holiday",
        "-": "No Record"
      }
    });
  } catch (error) {
    console.error('Public Attendance Matrix error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get public holiday info
 * @route   GET /api/public/holiday-info
 * @access  Public
 */
const getPublicHolidayInfo = async (req, res) => {
  try {
    // 1. Fetch upcoming active holidays (from today onwards), limit to 10
    const upcomingResult = await pool.query(`
      SELECT holiday_date, holiday_title as holiday_name, holiday_type, holiday_note as notes
      FROM holidays 
      WHERE is_enabled = true AND holiday_date >= CURRENT_DATE 
      ORDER BY holiday_date ASC 
      LIMIT 10
    `);

    if (upcomingResult.rows.length > 0) {
      return res.json({
        success: true,
        mode: "upcoming",
        holidays: upcomingResult.rows,
        message: null
      });
    }

    // 2. No upcoming found. Check for a recent completed holiday (within the last 1 day).
    const recentResult = await pool.query(`
      SELECT holiday_date, holiday_title as holiday_name, holiday_type, holiday_note as notes
      FROM holidays 
      WHERE is_enabled = true 
        AND holiday_date < CURRENT_DATE 
        AND holiday_date >= CURRENT_DATE - INTERVAL '1 day'
      ORDER BY holiday_date DESC 
      LIMIT 1
    `);

    if (recentResult.rows.length > 0) {
      const holiday = recentResult.rows[0];
      
      return res.json({
        success: true,
        mode: "recent_completed",
        holidays: [holiday],
        message: "Recently completed holiday."
      });
    }

    // 3. If no holidays found in the past 1 day or future
    return res.json({
      success: true,
      mode: "none",
      holidays: [],
      message: "No upcoming holidays announced yet. Stay focused and keep going strong."
    });

  } catch (error) {
    console.error('Public Holiday Info error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getPublicAttendanceMatrix,
  getPublicHolidayInfo
};
