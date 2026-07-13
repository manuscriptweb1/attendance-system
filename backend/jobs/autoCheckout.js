const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');

// Helper function to get local date in YYYY-MM-DD format
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Track if we already ran auto-checkout today
let lastAutoCheckoutDate = null;

// Auto checkout employees who checked in but forgot to checkout after office end time
const autoCheckoutEmployees = async () => {
  try {
    const today = getLocalDateString(); // Use local date instead of UTC
    
    // Get auto-checkout time from database
    const settingsResult = await pool.query(
      'SELECT auto_checkout_time FROM settings ORDER BY id LIMIT 1'
    );
    
    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auto_checkout_time) {
      return { success: false, message: 'Auto-checkout time not configured in settings' };
    }
    
    const autoCheckoutTime = settingsResult.rows[0].auto_checkout_time;
    const [autoHour, autoMinute] = autoCheckoutTime.split(':').map(Number);
    
    // Get current time in IST
    const currentTime = new Date();
    const istOffset = 5.5 * 60;
    const localTime = new Date(currentTime.getTime() + (istOffset * 60 * 1000));
    const currentHour = localTime.getUTCHours();
    const currentMinute = localTime.getUTCMinutes();

    // Check if it's the exact minute for auto-checkout
    if (currentHour !== autoHour || currentMinute !== autoMinute) {
      return { success: false, message: 'Not auto-checkout time' };
    }

    // Check if we already ran today
    if (lastAutoCheckoutDate === today) {
      return { success: false, message: 'Already ran auto-checkout today' };
    }

    console.log(`🔄 Running auto-checkout at ${autoCheckoutTime}...`);

    // Get half day threshold
    const settings = await getSettingsFromDB();
    const halfDayThreshold = settings.workingHours.halfDayThreshold;

    // Get all employees who checked in today but haven't checked out
    const result = await pool.query(
      `SELECT a.*, e.name 
       FROM attendance a
       JOIN employees e ON a.employee_id = e.employee_id
       WHERE a.attendance_date = $1 
       AND a.login_time IS NOT NULL 
       AND a.logout_time IS NULL`,
      [today]
    );

    if (result.rows.length === 0) {
      lastAutoCheckoutDate = today;
      return { success: true, checkedOut: 0, message: 'No employees to auto-checkout' };
    }

    let checkedOutCount = 0;

    for (const attendance of result.rows) {
      // Calculate working hours from login_time to now
      const loginTime = new Date(attendance.login_time);
      const logoutTime = new Date();
      const workingHours = ((logoutTime - loginTime) / (1000 * 60 * 60)).toFixed(2);

      // Determine final status
      let finalStatus = attendance.attendance_status;
      if (parseFloat(workingHours) < halfDayThreshold) {
        finalStatus = 'Half Day';
      }

      // Auto checkout
      await pool.query(
        `UPDATE attendance 
         SET logout_time = CURRENT_TIMESTAMP,
             total_working_hours = $1,
             attendance_status = $2,
             address_logout = 'Auto checkout by system',
             is_auto_checkout = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [workingHours, finalStatus, attendance.id]
      );

      checkedOutCount++;
      console.log(`✅ Auto-checkout: ${attendance.name} (${attendance.employee_id}) - ${workingHours}h`);
    }

    // Mark that we ran today
    lastAutoCheckoutDate = today;

    console.log(`✅ Auto-checkout completed: ${checkedOutCount} employee(s) checked out`);
    return {
      success: true,
      checkedOut: checkedOutCount,
      message: `${checkedOutCount} employee(s) auto-checked out`
    };

  } catch (error) {
    console.error('❌ Auto-checkout error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { autoCheckoutEmployees };
