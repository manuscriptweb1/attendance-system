const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { parseTime, getLocalTimeMinutes } = require('../utils/timeUtils');
const { autoCalculatePayroll } = require('./autoPayroll');

// Helper function to get local date in YYYY-MM-DD format (IST)
const getLocalDateString = () => {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const localTime = new Date(now.getTime() + (istOffset * 60 * 1000));
  const year = localTime.getUTCFullYear();
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Track last payroll calculation run key to avoid redundant payroll recalculations in the same minute
let lastAutoPayrollRunKey = null;

/**
 * Reset auto-checkout cache (useful when settings change or manual triggers happen)
 */
const resetAutoCheckoutLock = () => {
  lastAutoPayrollRunKey = null;
  console.log('🔄 Auto-checkout execution cache reset.');
};

/**
 * Auto checkout employees who checked in but haven't checked out after auto checkout time.
 * Also triggers automatic monthly payroll calculation.
 */
const autoCheckoutEmployees = async (options = {}) => {
  const { force = false } = options;

  try {
    const today = getLocalDateString();
    
    // Get auto-checkout time from database
    const settingsResult = await pool.query(
      'SELECT auto_checkout_time FROM settings ORDER BY id LIMIT 1'
    );
    
    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auto_checkout_time) {
      return { success: false, message: 'Auto-checkout time not configured in settings' };
    }
    
    const autoCheckoutTimeStr = settingsResult.rows[0].auto_checkout_time;
    const autoCheckoutMins = parseTime(autoCheckoutTimeStr);

    // Get current time in IST (minutes from midnight)
    const now = new Date();
    const currentMins = getLocalTimeMinutes(now);

    // Check if current time has reached or passed auto-checkout time (unless forced)
    if (!force && currentMins < autoCheckoutMins) {
      return { 
        success: false, 
        message: `Not auto-checkout time yet (Current: ${currentMins}m, Target: ${autoCheckoutMins}m)` 
      };
    }

    // Get half day threshold
    const settings = await getSettingsFromDB();
    const halfDayThreshold = settings.workingHours.halfDayThreshold || 4;

    // Fetch all active employees who checked in today but haven't checked out yet
    const result = await pool.query(
      `SELECT a.*, e.name 
       FROM attendance a
       JOIN employees e ON a.employee_id = e.employee_id
       WHERE a.attendance_date = $1 
       AND a.login_time IS NOT NULL 
       AND a.logout_time IS NULL`,
      [today]
    );

    let checkedOutCount = 0;

    if (result.rows.length > 0) {
      for (const attendance of result.rows) {
        const loginTime = new Date(attendance.login_time);
        const logoutTime = new Date();
        const workingHours = ((logoutTime - loginTime) / (1000 * 60 * 60)).toFixed(2);

        let finalStatus = attendance.attendance_status;
        if (parseFloat(workingHours) < halfDayThreshold) {
          finalStatus = 'Half Day';
        }

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
    }

    // Determine run key for payroll calculation
    const runKey = `${today}_${autoCheckoutTimeStr}_${checkedOutCount}`;

    let payrollResult = null;
    // Calculate payroll if employees were auto-checked out, or if payroll hasn't run for this configuration today
    if (checkedOutCount > 0 || lastAutoPayrollRunKey !== runKey || force) {
      console.log(`🔄 Triggering monthly payroll auto-calculation (Checked out: ${checkedOutCount})...`);
      payrollResult = await autoCalculatePayroll();
      lastAutoPayrollRunKey = runKey;
    } else {
      console.log(`ℹ️ Auto-checkout already complete and payroll updated for key: ${runKey}`);
    }

    return {
      success: true,
      checkedOut: checkedOutCount,
      payrollResult,
      message: `${checkedOutCount} employee(s) auto-checked out and payroll synchronized successfully`
    };

  } catch (error) {
    console.error('❌ Auto-checkout error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  autoCheckoutEmployees,
  resetAutoCheckoutLock
};
