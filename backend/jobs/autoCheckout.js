const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { parseTime, getLocalTimeMinutes, getOfficeTimes, calculateCheckOutStatus, calculateWorkedMinutes } = require('../utils/timeUtils');
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
// Track last date auto-checkout status was logged to prevent repetitive logs
let lastLoggedCheckoutDate = null;

/**
 * Reset auto-checkout cache (useful when settings change or manual triggers happen)
 */
const resetAutoCheckoutLock = () => {
  lastAutoPayrollRunKey = null;
  lastLoggedCheckoutDate = null;
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
    
    const rawAutoCheckoutTime = settingsResult.rows[0].auto_checkout_time;
    const autoCheckoutMins = parseTime(rawAutoCheckoutTime);

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

    // Format auto-checkout time as HH:MM:SS
    const timeParts = String(rawAutoCheckoutTime).trim().split(':');
    const autoCheckoutTimeStr = `${String(timeParts[0] || '18').padStart(2, '0')}:${String(timeParts[1] || '00').padStart(2, '0')}:${String(timeParts[2] || '00').padStart(2, '0')}`;

    // Get working hours settings
    const settings = await getSettingsFromDB();
    const officeTimes = getOfficeTimes(settings);
    const halfDayThreshold = officeTimes.halfDayThreshold || 4;

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
        // Construct exact ISO timestamp for auto-checkout on the attendance date
        // Format: YYYY-MM-DDTHH:mm:ss in local time
        const targetDate = attendance.attendance_date || today;
        const autoCheckoutTimestamp = `${targetDate}T${autoCheckoutTimeStr}`;

        // Calculate checkout status & early minutes
        const outStatusObj = calculateCheckOutStatus(autoCheckoutTimestamp, officeTimes.endTime);
        const checkoutStatus = outStatusObj.checkout_status === 'Late Check-Out' 
          ? 'late' 
          : (outStatusObj.checkout_status === 'Early Check-Out' ? 'early' : 'on_time');
        const earlyMinutes = outStatusObj.early_minutes || 0;

        // Calculate worked minutes & total hours
        const totalMinutes = calculateWorkedMinutes(attendance.login_time, autoCheckoutTimestamp, officeTimes.startTime);
        const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
        const workingHours = totalHours;

        // Determine final attendance status
        let finalStatus = attendance.attendance_status;
        if (finalStatus !== 'Absent') {
          if (totalHours < halfDayThreshold) {
            finalStatus = 'Half Day';
          }
        }

        await pool.query(
          `UPDATE attendance 
           SET logout_time = $1,
               total_working_hours = $2,
               total_hours = $3,
               total_minutes = $4,
               checkout_status = $5,
               early_minutes = $6,
               attendance_status = $7,
               address_logout = 'Auto checkout by system',
               is_auto_checkout = TRUE,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $8`,
          [
            autoCheckoutTimestamp,
            workingHours,
            totalHours,
            totalMinutes,
            checkoutStatus,
            earlyMinutes,
            finalStatus,
            attendance.id
          ]
        );

        checkedOutCount++;
        console.log(`✅ Auto-checkout: ${attendance.name} (${attendance.employee_id}) - ${workingHours}h at ${autoCheckoutTimeStr}`);
      }
    }

    // Determine run key for payroll calculation
    const runKey = `${today}_${autoCheckoutTimeStr}_${checkedOutCount}`;

    let payrollResult = null;
    // Calculate payroll if employees were auto-checked out, or if payroll hasn't run for this configuration today
    if (checkedOutCount > 0) {
      console.log(`🔄 Triggering monthly payroll auto-calculation (Checked out: ${checkedOutCount})...`);
      payrollResult = await autoCalculatePayroll();
      lastAutoPayrollRunKey = runKey;
      lastLoggedCheckoutDate = today;
    } else if (lastAutoPayrollRunKey !== runKey || force) {
      payrollResult = await autoCalculatePayroll();
      lastAutoPayrollRunKey = runKey;
      lastLoggedCheckoutDate = today;
    } else if (lastLoggedCheckoutDate !== today) {
      // Log ONLY ONCE per day when checkout time arrives and all employees are already checked out
      console.log(`ℹ️ Auto-checkout check for ${today}: All active employees are already checked out.`);
      lastLoggedCheckoutDate = today;
    }

    return {
      success: true,
      checkedOut: checkedOutCount,
      payrollResult,
      message: `${checkedOutCount} employee(s) auto-checked out at ${autoCheckoutTimeStr} and payroll synchronized successfully`
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
