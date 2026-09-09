const pool = require('../config/database');

/**
 * Helper function to get local date in YYYY-MM-DD format
 */
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Create daily attendance records with "Not Mention" status for all active employees
 * This should be run at the start of each day (e.g., via cron job or manual trigger)
 */
async function createDailyAbsentRecords(date = null) {
  try {
    const targetDate = date || getLocalDateString(); // Use local date instead of UTC
    
    console.log(`Checking daily absent records for date: ${targetDate}`);

    // 1. Check if targetDate is Sunday - skip creating absent records
    const [year, month, day] = targetDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getDay() === 0) {
      console.log(`⏩ Sunday detected (${targetDate}) - skipping absent records`);
      return { success: true, recordsCreated: 0, date: targetDate, reason: 'Sunday' };
    }

    // 2. Check if targetDate is an enabled holiday - skip creating absent records
    const holidayCheck = await pool.query(
      'SELECT id, holiday_title FROM holidays WHERE holiday_date = $1 AND is_enabled = true',
      [targetDate]
    );
    if (holidayCheck.rows.length > 0) {
      console.log(`⏩ Holiday detected (${holidayCheck.rows[0].holiday_title}) on ${targetDate} - skipping absent records`);
      return { success: true, recordsCreated: 0, date: targetDate, reason: 'Holiday' };
    }

    // Get all active employees who don't have attendance record for today
    const result = await pool.query(`
      INSERT INTO attendance (employee_id, attendance_date, attendance_status)
      SELECT e.employee_id, $1, 'Not Mention'
      FROM employees e
      WHERE e.status = 'Active'
      AND NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.employee_id = e.employee_id AND a.attendance_date = $1
      )
      RETURNING *
    `, [targetDate]);

    console.log(`✅ Created ${result.rowCount} absent records for ${targetDate}`);
    return {
      success: true,
      recordsCreated: result.rowCount,
      date: targetDate
    };

  } catch (error) {
    console.error('❌ Error creating daily absent records:', error);
    throw error;
  }
}

// If run directly
if (require.main === module) {
  createDailyAbsentRecords()
    .then(result => {
      console.log('✅ Job completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Job failed:', error);
      process.exit(1);
    });
}

module.exports = { createDailyAbsentRecords };
