const pool = require('../config/database');
const crypto = require('crypto');
const { validateAttendance, calculateAttendanceStatus } = require('../utils/attendanceValidator');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { parseTime, getOfficeTimes, getLocalMinutesFromUTC } = require('../utils/timeUtils');
const { logDeviceFingerprint, registerTrustedDevice, isTrustedDeviceApproved, generateFingerprint, validateTrustedDevice, parseDeviceInfo } = require('../services/deviceFingerprintService');
const { getClientIP, validateNetwork } = require('../services/networkValidationService');
const { logAudit, AUDIT_ACTIONS, AUDIT_STATUS } = require('../services/auditService');
const { isElectronRequest, verifyElectronSignature } = require('../utils/electronDeviceVerifier');
const { validateLocation, validateGPSAccuracy } = require('../utils/locationValidator');

// Helper function to get local date in YYYY-MM-DD format
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to convert 24-hour time to 12-hour format
const format24To12Hour = (time24) => {
  if (!time24) return time24;
  
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const minute = minutes;
  
  if (hour === 0) {
    return `12:${minute} AM`;
  } else if (hour < 12) {
    return `${hour}:${minute} AM`;
  } else if (hour === 12) {
    return `12:${minute} PM`;
  } else {
    return `${hour - 12}:${minute} PM`;
  }
};

// Helper function to ensure daily attendance records exist
const ensureDailyAttendanceRecords = async (date) => {
  const targetDate = date || getLocalDateString(); // Use local date instead of UTC
  
  try {
    // Check if date is Sunday - skip creating absent records
    // Use the date string to create a proper date object
    const [year, month, day] = targetDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // month is 0-indexed
    const dayOfWeek = dateObj.getDay();
    
    console.log('=== DAILY ABSENT RECORDS - SUNDAY CHECK ===');
    console.log('Target Date:', targetDate);
    console.log('Date Object:', dateObj.toDateString());
    console.log('Day of Week:', dayOfWeek, '(0=Sunday, 1=Monday, etc.)');
    
    if (dayOfWeek === 0) {
      console.log('✅ Sunday detected - skipping absent records');
      return 0; // Sunday - no absent records needed
    }
    
    // Check if date is an enabled holiday - skip creating absent records
    const holidayCheck = await pool.query(
      'SELECT * FROM holidays WHERE holiday_date = $1 AND is_enabled = true',
      [targetDate]
    );
    
    if (holidayCheck.rows.length > 0) {
      return 0; // Holiday - no absent records needed
    }
    
    // Create 'Not Mention' records for all active employees who don't have a record yet
    const result = await pool.query(`
      INSERT INTO attendance (employee_id, attendance_date, attendance_status)
      SELECT e.employee_id, $1, 'Not Mention'
      FROM employees e
      WHERE e.status = 'Active'
      AND NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.employee_id = e.employee_id AND a.attendance_date = $1
      )
      ON CONFLICT (employee_id, attendance_date) DO NOTHING
    `, [targetDate]);
    
    return result.rowCount;
  } catch (error) {
    console.error('Error ensuring daily attendance records:', error);
    return 0;
  }
};

// Employee Check-in (Login)
const checkIn = async (req, res) => {
  try {
    const employeeCode = req.user.employee_id; // Use employee code from JWT
    const {
      latitude,
      longitude,
      accuracy,
      address,
      device_info,
      browser_info,
      screenResolution,
      timezone
    } = req.body;

    const clientIP = getClientIP(req);
    const today = getLocalDateString(); // Use local date instead of UTC
    
    // === TEMPORARILY COMMENTED OUT FOR TESTING — UNCOMMENT AFTER TESTING ===
    // Check if today is Sunday (using current system date)
    const currentDate = new Date();
    const dayOfWeek = currentDate.getDay();
    
    console.log('=== SUNDAY CHECK ===');
    console.log('Current Date:', currentDate.toISOString());
    console.log('Local Date String:', today);
    console.log('Day of Week:', dayOfWeek, '(0=Sunday, 1=Monday, 2=Tuesday, etc.)');
    console.log('Date String:', today);
    
    if (dayOfWeek === 0) {
      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKIN_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Sunday', date: today, dayOfWeek }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Today is Sunday. Attendance is not required on Sundays.',
        isHoliday: true,
        holidayType: 'Sunday'
      });
    }
    // === END TEMPORARY COMMENT ===

    // Check if today is an enabled holiday
    const holidayCheck = await pool.query(
      'SELECT * FROM holidays WHERE holiday_date = $1 AND is_enabled = true',
      [today]
    );

    if (holidayCheck.rows.length > 0) {
      const holiday = holidayCheck.rows[0];
      
      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKIN_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Holiday', holidayTitle: holiday.holiday_title }
      });
      
      return res.status(403).json({
        success: false,
        message: `Today is a ${holiday.holiday_type}: ${holiday.holiday_title}. Attendance is not required today.`,
        isHoliday: true,
        holidayType: holiday.holiday_type,
        holidayTitle: holiday.holiday_title,
        holidayNote: holiday.holiday_note
      });
    }

    // Check if check-in is enabled
    const settings = await getSettingsFromDB();
    
    if (!settings.workingHours.checkInEnabled) {
      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKIN_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Check-in disabled by admin' }
      });
      
      return res.status(403).json({
        success: false,
        message: 'Check-in is currently disabled by administrator'
      });
    }

    // Check if current time is within office hours (after start time and before end time)
    // Get current time in IST (UTC+5:30)
    const currentTime = new Date();
    const istOffset = 5.5 * 60; // IST is UTC+5:30 in minutes
    const localTime = new Date(currentTime.getTime() + (istOffset * 60 * 1000));
    const currentHour = localTime.getUTCHours();
    const currentMinute = localTime.getUTCMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const officeTimes = getOfficeTimes(settings);
    const startTimeInMinutes = officeTimes.startTime;
    const endTimeInMinutes = officeTimes.endTime;
    const lateTimeInMinutes = officeTimes.lateTime;

    // Check if before office start time
    if (currentTimeInMinutes < startTimeInMinutes) {
      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKIN_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Before office start time' }
      });
      
      return res.status(403).json({
        success: false,
        errorCode: 'EARLY_CHECKIN',
        message: `Check-in is not allowed before office start time (${format24To12Hour(settings.workingHours.officeStartTime)})`
      });
    }

    // Check if after office end time
    if (currentTimeInMinutes > endTimeInMinutes) {
      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKIN_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { reason: 'After office end time' }
      });
      
      return res.status(403).json({
        success: false,
        message: `Check-in is not allowed after office end time (${format24To12Hour(settings.workingHours.officeEndTime)}). Office hours are ${format24To12Hour(settings.workingHours.officeStartTime)} to ${format24To12Hour(settings.workingHours.officeEndTime)}`
      });
    }
    
    // Get employee name
    const employeeResult = await pool.query(
      'SELECT name FROM employees WHERE employee_id = $1',
      [employeeCode]
    );
    const employeeName = employeeResult.rows.length > 0 ? employeeResult.rows[0].name : 'Unknown';
    
    // Check WFH permission for attendance status calculation
    const wfhResult = await pool.query(
      'SELECT is_enabled FROM wfh_permissions WHERE employee_id = $1',
      [employeeCode]
    );
    const isWFH = wfhResult.rows.length > 0 && wfhResult.rows[0].is_enabled;

    // === TRUSTED DEVICE VALIDATION ===
    const isElectron = isElectronRequest(req);
    let deviceValidation = { valid: false };
    let trustedDeviceId = null;
    let desktopPublicKeyHash = null;
    const deviceSource = isElectron ? 'electron-desktop' : 'browser';

    const validationEnabled = settings.trustedDevice ? settings.trustedDevice.validationEnabled : false;
    
    if (isElectron) {
      if (!settings.electronDesktop?.enabled) {
         return res.status(403).json({ success: false, errorCode: 'ELECTRON_ATTENDANCE_DISABLED', message: 'Check-in via the Electron Desktop App is currently disabled.' });
      }

      const electronMode = settings.electronDesktop.validationMode || 'trusted_device_and_network';
      
      const requiresTrustedDevice = ['trusted_device_only', 'trusted_device_or_network', 'trusted_device_and_network', 'location_and_trusted_device', 'location_and_trusted_device_and_network'].includes(electronMode);
      const requiresNetwork = ['network_only', 'trusted_device_or_network', 'trusted_device_and_network', 'location_and_network', 'location_and_trusted_device_and_network'].includes(electronMode);
      const requiresLocation = ['location_only', 'location_and_trusted_device', 'location_and_network', 'location_and_trusted_device_and_network'].includes(electronMode);
      const isOrMode = electronMode === 'trusted_device_or_network';

      // 1. Trusted Device Validation
      let trustedDevicePassed = false;
      let trustedDeviceError = null;

      const verificationResult = verifyElectronSignature(req);
      if (!verificationResult.valid) {
        trustedDeviceError = { errorCode: 'INVALID_SIGNATURE', message: verificationResult.message || 'We could not verify this desktop device.' };
      } else {
        desktopPublicKeyHash = verificationResult.publicKeyHash;
        const deviceResult = await pool.query(`SELECT * FROM trusted_devices WHERE employee_id = $1 AND desktop_public_key_hash = $2 AND device_source = 'electron-desktop'`, [employeeCode, desktopPublicKeyHash]);
        if (deviceResult.rows.length === 0 || deviceResult.rows[0].approved_status !== 'Approved') {
          trustedDeviceError = { errorCode: 'DEVICE_APPROVAL_REQUIRED', message: 'This desktop device is not approved yet. Please wait for administrator approval.' };
        } else {
          trustedDeviceId = deviceResult.rows[0].id;
          deviceValidation = { valid: true, fingerprint: `electron-${desktopPublicKeyHash}` };
          trustedDevicePassed = true;
        }
      }

      if (requiresTrustedDevice && !trustedDevicePassed && !isOrMode) {
        return res.status(403).json({ success: false, ...trustedDeviceError });
      }

      // 2. Network Validation
      let networkPassed = false;
      if (requiresNetwork && !isWFH) {
        const networkCheck = await validateNetwork(req);
        networkPassed = networkCheck.valid;
        if (!networkPassed && (!isOrMode || (!trustedDevicePassed && isOrMode))) {
           return res.status(403).json({ success: false, errorCode: 'ELECTRON_NETWORK_VALIDATION_FAILED', message: networkCheck.message });
        }
      } else if (isWFH) {
        networkPassed = true;
      }

      if (isOrMode && !trustedDevicePassed && !networkPassed) {
         return res.status(403).json({ success: false, errorCode: 'ELECTRON_VALIDATION_FAILED', message: 'Must pass either Trusted Device or Network validation.' });
      }

      // 3. Location Validation
      let locationPassed = false;
      if (requiresLocation && !isWFH) {
        if (!latitude || !longitude) {
           return res.status(400).json({ success: false, errorCode: 'ELECTRON_LOCATION_REQUIRED', message: 'Location coordinates are required for this validation mode.' });
        }
        const accuracyCheck = await validateGPSAccuracy(accuracy);
        if (!accuracyCheck.valid) {
           return res.status(400).json({ success: false, errorCode: 'ELECTRON_LOCATION_VALIDATION_FAILED', message: accuracyCheck.message });
        }
        const locationCheck = await validateLocation(parseFloat(latitude), parseFloat(longitude), false);
        if (!locationCheck.valid) {
           return res.status(403).json({ success: false, errorCode: 'ELECTRON_LOCATION_VALIDATION_FAILED', message: locationCheck.message });
        }
        locationPassed = true;
      } else if (isWFH) {
        locationPassed = true;
      }

      // If all passed, record attendance
      await ensureDailyAttendanceRecords(today);
      const existingAttendance = await pool.query('SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2', [employeeCode, today]);
      
      if (existingAttendance.rows.length > 0 && existingAttendance.rows[0].login_time) {
        await logAudit({ userId: employeeCode, userType: 'employee', action: AUDIT_ACTIONS.CHECKIN_FAILED, status: AUDIT_STATUS.FAILED, ipAddress: clientIP, userAgent: req.headers['user-agent'], details: { reason: 'Already checked in' } });
        return res.status(400).json({ success: false, message: 'You have already checked in today' });
      }

      const attendanceStatus = await calculateAttendanceStatus(isWFH);
      const sessionId = crypto.randomUUID();

      let result;
      if (existingAttendance.rows.length > 0) {
        result = await pool.query(
          `UPDATE attendance SET login_time = CURRENT_TIMESTAMP, latitude_login = $1, longitude_login = $2, address_login = $3, attendance_status = $4, is_wfh = $5, device_info = $6, browser_info = $7, ip_address = $8, gps_accuracy = $9, device_fingerprint = $10, validation_method = $11, session_id = $12, trusted_device_id = $13, device_source = $14, desktop_public_key_hash = $15, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $16 AND attendance_date = $17 RETURNING *`,
          [latitude, longitude, address, attendanceStatus, isWFH, device_info, browser_info, clientIP, accuracy, deviceValidation.fingerprint || 'electron', electronMode, sessionId, trustedDeviceId, deviceSource, desktopPublicKeyHash, employeeCode, today]
        );
      } else {
        result = await pool.query(
          `INSERT INTO attendance (employee_id, attendance_date, login_time, latitude_login, longitude_login, address_login, attendance_status, is_wfh, device_info, browser_info, ip_address, gps_accuracy, device_fingerprint, validation_method, session_id, trusted_device_id, device_source, desktop_public_key_hash) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
          [employeeCode, today, latitude, longitude, address, attendanceStatus, isWFH, device_info, browser_info, clientIP, accuracy, deviceValidation.fingerprint || 'electron', electronMode, sessionId, trustedDeviceId, deviceSource, desktopPublicKeyHash]
        );
      }

      await logAudit({ userId: employeeCode, userType: 'employee', action: AUDIT_ACTIONS.CHECKIN_SUCCESS, status: AUDIT_STATUS.SUCCESS, ipAddress: clientIP, userAgent: req.headers['user-agent'], deviceFingerprint: deviceValidation.fingerprint, details: { attendanceStatus, validationMethod: electronMode, isWFH, gpsAccuracy: accuracy } });
      
      return res.json({ success: true, message: 'Check-in successful (Electron)', attendance: result.rows[0], validationMethod: electronMode, sessionId });

    } else {
      // Browser logic
      deviceValidation = await validateTrustedDevice(employeeCode, employeeName, req, validationEnabled, { screenResolution, timezone });

      if (!deviceValidation.valid) {
        await logAudit({ userId: employeeCode, userType: 'employee', action: AUDIT_ACTIONS.CHECKIN_FAILED, status: AUDIT_STATUS.FAILED, ipAddress: clientIP, userAgent: req.headers['user-agent'], deviceFingerprint: deviceValidation.fingerprint, details: { reason: deviceValidation.message, deviceStatus: deviceValidation.deviceStatus, isNewDevice: deviceValidation.isNewDevice } });
        return res.status(403).json(deviceValidation);
      }

      if (validationEnabled) {
        console.log('✅ Trusted device APPROVED - Allowing attendance, skipping location/network validation');
        await ensureDailyAttendanceRecords(today);
        const existingAttendance = await pool.query('SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2', [employeeCode, today]);
        
        if (existingAttendance.rows.length > 0 && existingAttendance.rows[0].login_time) {
          await logAudit({ userId: employeeCode, userType: 'employee', action: AUDIT_ACTIONS.CHECKIN_FAILED, status: AUDIT_STATUS.FAILED, ipAddress: clientIP, userAgent: req.headers['user-agent'], details: { reason: 'Already checked in' } });
          return res.status(400).json({ success: false, message: 'You have already checked in today' });
        }
        
        const attendanceStatus = await calculateAttendanceStatus(isWFH);
        const sessionId = crypto.randomUUID();
        
        let result;
        if (existingAttendance.rows.length > 0) {
          result = await pool.query(
            `UPDATE attendance SET login_time = CURRENT_TIMESTAMP, latitude_login = $1, longitude_login = $2, address_login = $3, attendance_status = $4, is_wfh = $5, device_info = $6, browser_info = $7, ip_address = $8, gps_accuracy = $9, device_fingerprint = $10, validation_method = $11, session_id = $12, trusted_device_id = $13, device_source = $14, desktop_public_key_hash = $15, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $16 AND attendance_date = $17 RETURNING *`,
            [latitude, longitude, address, attendanceStatus, isWFH, device_info, browser_info, clientIP, accuracy, deviceValidation.fingerprint, 'trusted_device', sessionId, trustedDeviceId, deviceSource, desktopPublicKeyHash, employeeCode, today]
          );
        } else {
          result = await pool.query(
            `INSERT INTO attendance (employee_id, attendance_date, login_time, latitude_login, longitude_login, address_login, attendance_status, is_wfh, device_info, browser_info, ip_address, gps_accuracy, device_fingerprint, validation_method, session_id, trusted_device_id, device_source, desktop_public_key_hash) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
            [employeeCode, today, latitude, longitude, address, attendanceStatus, isWFH, device_info, browser_info, clientIP, accuracy, deviceValidation.fingerprint, 'trusted_device', sessionId, trustedDeviceId, deviceSource, desktopPublicKeyHash]
          );
        }
        
        await logAudit({ userId: employeeCode, userType: 'employee', action: AUDIT_ACTIONS.CHECKIN_SUCCESS, status: AUDIT_STATUS.SUCCESS, ipAddress: clientIP, userAgent: req.headers['user-agent'], deviceFingerprint: deviceValidation.fingerprint, details: { attendanceStatus, validationMethod: 'trusted_device', isWFH, gpsAccuracy: accuracy } });
        
        return res.json({ success: true, message: 'Check-in successful (Trusted Device)', attendance: result.rows[0], validationMethod: 'trusted_device', sessionId });
      }
    }
    // === END TRUSTED DEVICE VALIDATION ===
    
    // Validation
    if (!latitude || !longitude) {
      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKIN_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Missing coordinates' }
      });
      
      return res.status(400).json({
        success: false,
        message: 'Location coordinates are required'
      });
    }

    // Ensure daily attendance records exist for today
    await ensureDailyAttendanceRecords(today);

    // Check if already checked in today
    const existingAttendance = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
      [employeeCode, today]
    );

    if (existingAttendance.rows.length > 0 && existingAttendance.rows[0].login_time) {
      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKIN_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { reason: 'Already checked in' }
      });
      
      return res.status(400).json({
        success: false,
        message: 'You have already checked in today'
      });
    }



    // Validate attendance using new multi-mode validator
    const validationResult = await validateAttendance(
      req,
      latitude,
      longitude,
      accuracy,
      isWFH
    );

    if (!validationResult.valid) {
      // Log validation failure
      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: validationResult.method === 'location' ? AUDIT_ACTIONS.LOCATION_VALIDATION_FAILED : AUDIT_ACTIONS.NETWORK_VALIDATION_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { 
          reason: validationResult.message,
          validationMode: settings.validation.attendanceValidationMode,
          gpsAccuracy: accuracy,
          distance: validationResult.distance
        }
      });
      
      return res.status(400).json({
        success: false,
        message: validationResult.message,
        distance: validationResult.distance,
        validationMode: settings.validation.attendanceValidationMode
      });
    }

    // Calculate attendance status on backend (NEVER trust frontend)
    const attendanceStatus = await calculateAttendanceStatus(isWFH);

    // Log device fingerprint
    const deviceData = await logDeviceFingerprint(employeeCode, req, {
      screenResolution,
      timezone
    });

    const sessionId = crypto.randomUUID();

    // Calculate Late
    
    let checkin_status = 'on_time';
    let late_minutes = 0;
    
    if (currentTimeInMinutes > lateTimeInMinutes) {
        checkin_status = 'late';
        late_minutes = currentTimeInMinutes - lateTimeInMinutes;
    }

    // Insert or update attendance
    let result;
    if (existingAttendance.rows.length > 0) {
      result = await pool.query(
        `UPDATE attendance 
         SET login_time = CURRENT_TIMESTAMP,
             latitude_login = $1,
             longitude_login = $2,
             address_login = $3,
             attendance_status = $4,
             is_wfh = $5,
             device_info = $6,
             browser_info = $7,
             ip_address = $8,
             gps_accuracy = $9,
             device_fingerprint = $10,
             validation_method = $11,
             session_id = $12,
             trusted_device_id = $13,
             device_source = $14,
             desktop_public_key_hash = $15,
             checkin_status = $16,
             late_minutes = $17,
             updated_at = CURRENT_TIMESTAMP
         WHERE employee_id = $18 AND attendance_date = $19
         RETURNING *`,
        [latitude, longitude, address, attendanceStatus, isWFH, 
         device_info, browser_info, clientIP, accuracy, 
         deviceData ? deviceData.fingerprint : null, validationResult.method, sessionId,
         trustedDeviceId, deviceSource, desktopPublicKeyHash,
         checkin_status, late_minutes,
         employeeCode, today]
      );
    } else {
      result = await pool.query(
        `INSERT INTO attendance 
         (employee_id, attendance_date, login_time, latitude_login, longitude_login, 
          address_login, attendance_status, is_wfh, device_info, browser_info, 
          ip_address, gps_accuracy, device_fingerprint, validation_method, session_id,
          trusted_device_id, device_source, desktop_public_key_hash, checkin_status, late_minutes)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *`,
        [employeeCode, today, latitude, longitude, address, attendanceStatus, 
         isWFH, device_info, browser_info, clientIP, accuracy,
         deviceData ? deviceData.fingerprint : null, validationResult.method, sessionId,
         trustedDeviceId, deviceSource, desktopPublicKeyHash, checkin_status, late_minutes]
      );
    }

    // Log successful check-in
    await logAudit({
      userId: employeeCode,
      userType: 'employee',
      action: AUDIT_ACTIONS.CHECKIN_SUCCESS,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      deviceFingerprint: deviceData ? deviceData.fingerprint : null,
      details: { 
        attendanceStatus,
        validationMethod: validationResult.method,
        isWFH,
        gpsAccuracy: accuracy
      }
    });

    return res.json({
      success: true,
      message: 'Check-in successful',
      attendance: result.rows[0],
      validationMethod: validationResult.method,
      sessionId
    });

  } catch (error) {
    console.error('Check-in error:', error);
    
    // Log error
    try {
      await logAudit({
        userId: req.user?.employee_id || 'unknown',
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKIN_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
        details: { error: error.message }
      });
    } catch (logError) {
      console.error('Error logging audit:', logError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Employee Check-out (Logout)
const checkOut = async (req, res) => {
  try {
    const employeeCode = req.user.employee_id; // Use employee code from JWT
    const {
      latitude,
      longitude,
      address,
      device_info,
      browser_info,
      screenResolution,
      timezone,
      sessionId
    } = req.body;

    // Check if check-out is enabled
    const settings = await getSettingsFromDB();
    if (!settings.workingHours.checkOutEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Check-out is currently disabled by administrator'
      });
    }

    const today = getLocalDateString(); // Use local date instead of UTC

    // Get employee name
    const employeeResult = await pool.query(
      'SELECT name FROM employees WHERE employee_id = $1',
      [employeeCode]
    );
    const employeeName = employeeResult.rows.length > 0 ? employeeResult.rows[0].name : 'Unknown';

    // Check WFH permission
    const wfhResult = await pool.query(
      'SELECT is_enabled FROM wfh_permissions WHERE employee_id = $1',
      [employeeCode]
    );
    const isWFH = wfhResult.rows.length > 0 && wfhResult.rows[0].is_enabled;

    // Check if checked in today
    const attendanceResult = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
      [employeeCode, today]
    );

    if (attendanceResult.rows.length === 0 || !attendanceResult.rows[0].login_time) {
      return res.status(400).json({
        success: false,
        message: 'You must check in first'
      });
    }

    const attendance = attendanceResult.rows[0];

    // Check if already checked out
    if (attendance.logout_time) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out today'
      });
    }

    // === ATTENDANCE SESSION & DEVICE VALIDATION (ALWAYS ON) ===
    const isElectron = isElectronRequest(req);
    let electronPublicKeyHash = null;
    let trustedDeviceId = null;
    let validationMethod = 'standard';
    let deviceValidation = { valid: false, fingerprint: null };
    
    const currentFingerprint = generateFingerprint(req);
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceDetails = parseDeviceInfo(userAgent);

    if (isElectron) {
      const verificationResult = verifyElectronSignature(req);
      if (!verificationResult.valid) {
        return res.status(403).json({
          success: false,
          errorCode: 'INVALID_SIGNATURE',
          title: 'Desktop Device Verification Failed',
          message: verificationResult.message || 'We could not verify this desktop device. Please use the official Attendance Desktop App.'
        });
      }
      electronPublicKeyHash = verificationResult.publicKeyHash;
      deviceValidation.fingerprint = `electron-${electronPublicKeyHash}`;
    } else {
      deviceValidation.fingerprint = currentFingerprint;
    }

    const sessionMismatch = attendance.session_id && sessionId !== attendance.session_id;
    const fingerprintMismatch = attendance.device_fingerprint && !isElectron && currentFingerprint !== attendance.device_fingerprint;
    
    const isCheckInElectron = attendance.device_source === 'electron-desktop';
    let electronMismatch = false;
    
    if (isCheckInElectron) {
      if (!isElectron) {
        electronMismatch = true;
      } else if (attendance.desktop_public_key_hash !== electronPublicKeyHash) {
        electronMismatch = true;
      }
    } else if (isElectron) {
      electronMismatch = true;
    }

    if (sessionMismatch || fingerprintMismatch || electronMismatch) {
      console.log('❌ CHECK-OUT BLOCKED - Session or Device mismatch');
      console.log('Check-In Session:', attendance.session_id);
      console.log('Current Session:', sessionId);
      console.log('Check-In Fingerprint:', attendance.device_fingerprint);
      console.log('Current Fingerprint:', currentFingerprint);
      console.log('Electron Mismatch:', electronMismatch);

      await logAudit({
        userId: employeeCode,
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKOUT_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: userAgent,
        deviceFingerprint: deviceValidation.fingerprint,
        details: {
          reason: sessionMismatch && (fingerprintMismatch || electronMismatch) ? 'Both Session and Device mismatch (High Risk)' : 
                  sessionMismatch ? 'Attendance Session mismatch' : 'Check-Out attempted from a different device',
          checkInSession: attendance.session_id,
          currentSession: sessionId,
          checkInFingerprint: attendance.device_fingerprint,
          currentFingerprint: currentFingerprint,
          electronMismatch,
          browser: deviceDetails.browser,
          os: deviceDetails.os,
          deviceType: deviceDetails.deviceType,
          attendanceDate: today,
          validationResult: sessionMismatch ? 'session_mismatch' : 'device_mismatch'
        }
      });

      if (electronMismatch) {
        return res.status(403).json({
          success: false,
          valid: false,
          deviceMismatch: true,
          errorCode: 'CHECKOUT_DEVICE_MISMATCH',
          title: 'Check-Out Not Allowed',
          message: 'For attendance security, you must complete Check-Out using the same approved device that was used for Check-In.'
        });
      } else if (sessionMismatch && fingerprintMismatch) {
        return res.status(403).json({
          success: false,
          valid: false,
          sessionInvalid: true,
          message: 'Your attendance session is no longer valid. Please contact your administrator if you believe this is an error.'
        });
      } else if (sessionMismatch) {
        return res.status(403).json({
          success: false,
          valid: false,
          sessionInvalid: true,
          message: 'Your attendance session is no longer valid. Please contact your administrator if you believe this is an error.'
        });
      } else if (fingerprintMismatch) {
        return res.status(403).json({
          success: false,
          valid: false,
          deviceMismatch: true,
          message: 'For attendance security, you must complete Check-Out using the same device that was used for Check-In. Please return to your original device.'
        });
      }
    }
    console.log('✅ Session and Device verified - MATCH');
    // === END ATTENDANCE SESSION VALIDATION ===

    // === VALIDATION MODE LOGIC ===
    const validationEnabled = settings.trustedDevice ? settings.trustedDevice.validationEnabled : false;
    
    if (isElectron) {
      if (!settings.electronDesktop?.enabled) {
         return res.status(403).json({ success: false, errorCode: 'ELECTRON_ATTENDANCE_DISABLED', message: 'Check-out via the Electron Desktop App is currently disabled.' });
      }

      const electronMode = settings.electronDesktop.validationMode || 'trusted_device_and_network';
      validationMethod = electronMode;
      
      const requiresTrustedDevice = ['trusted_device_only', 'trusted_device_or_network', 'trusted_device_and_network', 'location_and_trusted_device', 'location_and_trusted_device_and_network'].includes(electronMode);
      const requiresNetwork = ['network_only', 'trusted_device_or_network', 'trusted_device_and_network', 'location_and_network', 'location_and_trusted_device_and_network'].includes(electronMode);
      const requiresLocation = ['location_only', 'location_and_trusted_device', 'location_and_network', 'location_and_trusted_device_and_network'].includes(electronMode);
      const isOrMode = electronMode === 'trusted_device_or_network';

      // 1. Trusted Device Validation
      let trustedDevicePassed = false;
      let trustedDeviceError = null;

      const deviceResult = await pool.query(`SELECT * FROM trusted_devices WHERE employee_id = $1 AND desktop_public_key_hash = $2 AND device_source = 'electron-desktop'`, [employeeCode, electronPublicKeyHash]);
      if (deviceResult.rows.length === 0 || deviceResult.rows[0].approved_status !== 'Approved') {
        trustedDeviceError = { errorCode: 'DEVICE_APPROVAL_REQUIRED', message: 'This desktop device is not approved yet. Please wait for administrator approval.' };
      } else {
        trustedDeviceId = deviceResult.rows[0].id;
        trustedDevicePassed = true;
      }

      if (requiresTrustedDevice && !trustedDevicePassed && !isOrMode) {
        return res.status(403).json({ success: false, ...trustedDeviceError });
      }

      // 2. Network Validation
      let networkPassed = false;
      if (requiresNetwork && !isWFH) {
        const networkCheck = await validateNetwork(req);
        networkPassed = networkCheck.valid;
        if (!networkPassed && (!isOrMode || (!trustedDevicePassed && isOrMode))) {
           return res.status(403).json({ success: false, errorCode: 'ELECTRON_NETWORK_VALIDATION_FAILED', message: networkCheck.message });
        }
      } else if (isWFH) {
        networkPassed = true;
      }

      if (isOrMode && !trustedDevicePassed && !networkPassed) {
         return res.status(403).json({ success: false, errorCode: 'ELECTRON_VALIDATION_FAILED', message: 'Must pass either Trusted Device or Network validation.' });
      }

      // 3. Location Validation
      let locationPassed = false;
      if (requiresLocation && !isWFH) {
        if (!latitude || !longitude) {
           return res.status(400).json({ success: false, errorCode: 'ELECTRON_LOCATION_REQUIRED', message: 'Location coordinates are required for this validation mode.' });
        }
        const accuracyCheck = await validateGPSAccuracy(req.body.accuracy || 100);
        if (!accuracyCheck.valid) {
           return res.status(400).json({ success: false, errorCode: 'ELECTRON_LOCATION_VALIDATION_FAILED', message: accuracyCheck.message });
        }
        const locationCheck = await validateLocation(parseFloat(latitude), parseFloat(longitude), false);
        if (!locationCheck.valid) {
           return res.status(403).json({ success: false, errorCode: 'ELECTRON_LOCATION_VALIDATION_FAILED', message: locationCheck.message });
        }
        locationPassed = true;
      } else if (isWFH) {
        locationPassed = true;
      }
    } else {
      // Browser logic
      deviceValidation = await validateTrustedDevice(employeeCode, employeeName, req, validationEnabled, { screenResolution, timezone });
      if (!deviceValidation.valid) {
        await logAudit({
          userId: employeeCode, userType: 'employee', action: AUDIT_ACTIONS.CHECKOUT_FAILED, status: AUDIT_STATUS.FAILED, ipAddress: clientIP, userAgent: userAgent, deviceFingerprint: deviceValidation.fingerprint,
          details: { reason: deviceValidation.message, deviceStatus: deviceValidation.deviceStatus, isNewDevice: deviceValidation.isNewDevice, validationResult: 'denied' }
        });
        return res.status(403).json(deviceValidation);
      }
      
      if (validationEnabled) {
        validationMethod = 'trusted_device';
      } else {
         // Perform normal network/location validation for checkout if needed
         // Using multi-mode validator
         const locValidationResult = await validateAttendance(req, latitude, longitude, req.body.accuracy || 100, isWFH);
         if (!locValidationResult.valid) {
           await logAudit({ userId: employeeCode, userType: 'employee', action: AUDIT_ACTIONS.CHECKOUT_FAILED, status: AUDIT_STATUS.FAILED, ipAddress: clientIP, userAgent: userAgent, details: { reason: locValidationResult.message, validationMethod: locValidationResult.method } });
           return res.status(403).json(locValidationResult);
         }
         validationMethod = locValidationResult.method;
      }
    }
    // === END VALIDATION MODE LOGIC ===

    // Check early checkout permission
    const earlyCheckoutResult = await pool.query(
      'SELECT is_enabled FROM early_checkout_permissions WHERE employee_id = $1',
      [employeeCode]
    );

    const hasEarlyCheckoutPermission = earlyCheckoutResult.rows.length > 0 && 
                                        earlyCheckoutResult.rows[0].is_enabled;

    // Get current time in IST (UTC+5:30)
    const currentTime = new Date();
    const istOffset = 5.5 * 60; // IST is UTC+5:30 in minutes
    const localTime = new Date(currentTime.getTime() + (istOffset * 60 * 1000));
    const currentHour = localTime.getUTCHours();
    const currentMinute = localTime.getUTCMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const officeTimes = getOfficeTimes(settings);
    const endTimeInMinutes = officeTimes.endTime;

    console.log('=== CHECK-OUT TIME VALIDATION ===');
    console.log('System Time:', currentTime.toISOString());
    console.log('IST Time:', localTime.toISOString());
    console.log('Current Hour:', currentHour, 'Minute:', currentMinute);
    console.log('Current Time (minutes):', currentTimeInMinutes);
    console.log('Office End Time:', settings.workingHours.officeEndTime);
    console.log('Office End Time (minutes):', endTimeInMinutes);
    console.log('Has Early Checkout Permission:', hasEarlyCheckoutPermission);

    // Check if current time is before office end time
    if (!hasEarlyCheckoutPermission) {

      if (currentTimeInMinutes < endTimeInMinutes) {
        console.log('❌ Check-out BLOCKED - Before office end time');
        
        // Log failed checkout attempt
        await logAudit({
          userId: employeeCode,
          userType: 'employee',
          action: AUDIT_ACTIONS.CHECKOUT_FAILED,
          status: AUDIT_STATUS.FAILED,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
          details: { 
            reason: 'Before office end time',
            currentTime: `${currentHour}:${currentMinute}`,
            officeEndTime: settings.workingHours.officeEndTime
          }
        });
        
        return res.status(403).json({
          success: false,
          errorCode: 'EARLY_CHECKOUT',
          message: `Check-out is not allowed before office end time (${format24To12Hour(settings.workingHours.officeEndTime)}). Contact admin for early checkout permission.`
        });
      }
      
      console.log('✅ Check-out ALLOWED - After office end time');
    } else {
      console.log('✅ Check-out ALLOWED - Has early checkout permission');
    }

    // Calculate working hours
    const loginTime = new Date(attendance.login_time);
    const logoutTime = new Date();
    const totalMinutes = Math.floor((logoutTime - loginTime) / (1000 * 60));
    const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
    const workingHours = ((logoutTime - loginTime) / (1000 * 60 * 60)).toFixed(2);

    // Update attendance status based on working hours (from database)
    const halfDayThreshold = settings.workingHours.halfDayThreshold;
    let finalStatus = attendance.attendance_status;
    if (parseFloat(workingHours) < halfDayThreshold) {
      finalStatus = 'Half Day';
    }

    // Calculate Early Status
    let checkout_status = 'normal';
    let early_minutes = 0;
    if (currentTimeInMinutes < endTimeInMinutes) {
      checkout_status = 'early';
      early_minutes = endTimeInMinutes - currentTimeInMinutes;
    }

    // Update attendance (include device fingerprint and validation method from checkout)
    const result = await pool.query(
      `UPDATE attendance 
       SET logout_time = CURRENT_TIMESTAMP,
           latitude_logout = $1,
           longitude_logout = $2,
           address_logout = $3,
           total_working_hours = $4,
           attendance_status = $5,
           total_hours = $12,
           total_minutes = $13,
           device_fingerprint = COALESCE($8, device_fingerprint),
           validation_method = COALESCE($9, validation_method),
           checkout_status = $10,
           early_minutes = $11,
           updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = $6 AND attendance_date = $7
       RETURNING *`,
      [latitude, longitude, address, workingHours, finalStatus, employeeCode, today,
       deviceValidation.fingerprint || null,
       validationMethod, checkout_status, early_minutes, totalHours, totalMinutes]
    );

    // Log successful check-out
    await logAudit({
      userId: employeeCode,
      userType: 'employee',
      action: AUDIT_ACTIONS.CHECKOUT_SUCCESS,
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: clientIP,
      userAgent: req.headers['user-agent'],
      deviceFingerprint: deviceValidation.fingerprint || null,
      details: { 
        finalStatus,
        workingHours: parseFloat(workingHours),
        earlyCheckout: hasEarlyCheckoutPermission,
        validationMethod: validationMethod
      }
    });

    res.json({
      success: true,
      message: 'Check-out successful',
      attendance: result.rows[0]
    });

  } catch (error) {
    console.error('Check-out error:', error);
    
    // Log error
    try {
      const clientIP = getClientIP(req);
      await logAudit({
        userId: req.user?.employee_id || 'unknown',
        userType: 'employee',
        action: AUDIT_ACTIONS.CHECKOUT_FAILED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { error: error.message }
      });
    } catch (logError) {
      console.error('Error logging audit:', logError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get today's attendance for employee
const getTodayAttendance = async (req, res) => {
  try {
    const employeeCode = req.user.employee_id; // Use employee code from JWT
    const today = getLocalDateString(); // Use local date instead of UTC

    // === TRUSTED DEVICE VALIDATION (BLOCK ON LOAD) ===
    const settings = await getSettingsFromDB();
    const validationEnabled = settings.trustedDevice ? settings.trustedDevice.validationEnabled : false;
    
    // Get employee name
    const employeeResult = await pool.query(
      'SELECT name FROM employees WHERE employee_id = $1',
      [employeeCode]
    );
    const employeeName = employeeResult.rows.length > 0 ? employeeResult.rows[0].name : 'Unknown';

    if (isElectronRequest(req)) {
      const verificationResult = verifyElectronSignature(req);
      if (!verificationResult.valid) {
        return res.status(403).json({
          success: false,
          errorCode: 'INVALID_SIGNATURE',
          title: 'Desktop Device Verification Failed',
          message: verificationResult.message || 'We could not verify this desktop device. Please use the official Attendance Desktop App.'
        });
      }
      
      const deviceResult = await pool.query(
        `SELECT * FROM trusted_devices 
         WHERE employee_id = $1 AND desktop_public_key_hash = $2 AND device_source = 'electron-desktop'`,
        [employeeCode, verificationResult.publicKeyHash]
      );
      
      if (deviceResult.rows.length === 0 || deviceResult.rows[0].approved_status !== 'Approved') {
        const status = deviceResult.rows.length > 0 ? deviceResult.rows[0].approved_status : 'Not Found';
        let errorCode = 'DEVICE_APPROVAL_REQUIRED';
        let message = 'This desktop device is not approved yet. Please wait for administrator approval before signing in.';
        let title = 'Device Approval Required';
        
        if (status === 'Pending') {
          errorCode = 'DEVICE_APPROVAL_PENDING';
          title = 'Approval Pending';
          message = 'Your desktop device approval request is still pending. Please contact your administrator.';
        } else if (status === 'Blocked') {
          errorCode = 'DEVICE_BLOCKED';
          title = 'Device Blocked';
          message = 'This desktop device has been blocked by your administrator. Please contact your administrator.';
        } else if (status === 'Rejected') {
          errorCode = 'DEVICE_REJECTED';
          title = 'Device Rejected';
          message = 'This desktop device was rejected by your administrator. Please contact your administrator.';
        }

        return res.status(403).json({
          success: false,
          errorCode,
          title,
          message
        });
      }
    } else {
      const deviceValidation = await validateTrustedDevice(employeeCode, employeeName, req, validationEnabled, {});

      if (!deviceValidation.valid) {
        return res.status(403).json(deviceValidation);
      }
    }
    // === END TRUSTED DEVICE VALIDATION ===

    const result = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
      [employeeCode, today]
    );

    res.json({
      success: true,
      attendance: result.rows[0] || null
    });

  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get employee monthly attendance
const getEmployeeMonthlyAttendance = async (req, res) => {
  try {
    const employeeCode = req.user.employee_id; // Use employee code from JWT
    const { month, year } = req.query;

    // === TRUSTED DEVICE VALIDATION (BLOCK ON LOAD) ===
    const settings = await getSettingsFromDB();
    const validationEnabled = settings.trustedDevice ? settings.trustedDevice.validationEnabled : false;
    
    // Get employee name
    const employeeResult = await pool.query(
      'SELECT name FROM employees WHERE employee_id = $1',
      [employeeCode]
    );
    const employeeName = employeeResult.rows.length > 0 ? employeeResult.rows[0].name : 'Unknown';

    if (isElectronRequest(req)) {
      const verificationResult = verifyElectronSignature(req);
      if (!verificationResult.valid) {
        return res.status(403).json({
          success: false,
          errorCode: 'INVALID_SIGNATURE',
          title: 'Desktop Device Verification Failed',
          message: verificationResult.message || 'We could not verify this desktop device. Please use the official Attendance Desktop App.'
        });
      }
      
      const deviceResult = await pool.query(
        `SELECT * FROM trusted_devices 
         WHERE employee_id = $1 AND desktop_public_key_hash = $2 AND device_source = 'electron-desktop'`,
        [employeeCode, verificationResult.publicKeyHash]
      );
      
      if (deviceResult.rows.length === 0 || deviceResult.rows[0].approved_status !== 'Approved') {
        const status = deviceResult.rows.length > 0 ? deviceResult.rows[0].approved_status : 'Not Found';
        let errorCode = 'DEVICE_APPROVAL_REQUIRED';
        let message = 'This desktop device is not approved yet. Please wait for administrator approval before signing in.';
        let title = 'Device Approval Required';
        
        if (status === 'Pending') {
          errorCode = 'DEVICE_APPROVAL_PENDING';
          title = 'Approval Pending';
          message = 'Your desktop device approval request is still pending. Please contact your administrator.';
        } else if (status === 'Blocked') {
          errorCode = 'DEVICE_BLOCKED';
          title = 'Device Blocked';
          message = 'This desktop device has been blocked by your administrator. Please contact your administrator.';
        } else if (status === 'Rejected') {
          errorCode = 'DEVICE_REJECTED';
          title = 'Device Rejected';
          message = 'This desktop device was rejected by your administrator. Please contact your administrator.';
        }

        return res.status(403).json({
          success: false,
          errorCode,
          title,
          message
        });
      }
    } else {
      const deviceValidation = await validateTrustedDevice(employeeCode, employeeName, req, validationEnabled, {});

      if (!deviceValidation.valid) {
        return res.status(403).json(deviceValidation);
      }
    }
    // === END TRUSTED DEVICE VALIDATION ===

    let query;
    let values;

    if (month && year) {
      query = `SELECT * FROM attendance 
               WHERE employee_id = $1 
               AND EXTRACT(MONTH FROM attendance_date) = $2 
               AND EXTRACT(YEAR FROM attendance_date) = $3
               ORDER BY attendance_date DESC`;
      values = [employeeCode, month, year];
    } else {
      query = `SELECT * FROM attendance 
               WHERE employee_id = $1 
               ORDER BY attendance_date DESC 
               LIMIT 30`;
      values = [employeeCode];
    }

    const result = await pool.query(query, values);

    // Fetch holidays for the same period
    let holidayQuery;
    let holidayValues;
    
    if (month && year) {
      holidayQuery = `SELECT * FROM holidays 
                      WHERE EXTRACT(MONTH FROM holiday_date) = $1 
                      AND EXTRACT(YEAR FROM holiday_date) = $2
                      AND is_enabled = true
                      ORDER BY holiday_date`;
      holidayValues = [month, year];
    } else {
      holidayQuery = `SELECT * FROM holidays 
                      WHERE is_enabled = true
                      ORDER BY holiday_date DESC
                      LIMIT 30`;
      holidayValues = [];
    }

    const holidayResult = await pool.query(holidayQuery, holidayValues);

    // --- Calculate Dashboard Stats ---
    const now = new Date();
    // Offset local timezone safely
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const todayStr = now.toISOString().split('T')[0];
    
    // Determine the range of days to evaluate
    let targetYear = year ? parseInt(year) : now.getFullYear();
    let targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    
    // Max day to iterate: if current month, up to today's date. Otherwise, last day of that month.
    let isCurrentMonth = (targetYear === now.getFullYear() && targetMonth === now.getMonth());
    let maxDay = isCurrentMonth ? now.getDate() : new Date(targetYear, targetMonth + 1, 0).getDate();

    let eligibleDays = 0;
    let attendedDays = 0;
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let wfhDays = 0;

    for (let d = 1; d <= maxDay; d++) {
      const iterDate = new Date(targetYear, targetMonth, d);
      // Skip Sunday (0)
      if (iterDate.getDay() === 0) continue;

      // Local string for the iterated date
      iterDate.setMinutes(iterDate.getMinutes() - iterDate.getTimezoneOffset());
      const iterStr = iterDate.toISOString().split('T')[0];

      // Skip holidays
      const isHoliday = holidayResult.rows.some(h => {
        const hd = new Date(h.holiday_date);
        hd.setMinutes(hd.getMinutes() - hd.getTimezoneOffset());
        return hd.toISOString().split('T')[0] === iterStr;
      });
      if (isHoliday) continue;

      // Find attendance record
      const record = result.rows.find(r => {
        const rd = new Date(r.attendance_date);
        rd.setMinutes(rd.getMinutes() - rd.getTimezoneOffset());
        return rd.toISOString().split('T')[0] === iterStr;
      });

      const status = record ? record.attendance_status : 'Not Mention';
      const isWfh = record ? record.is_wfh : false;

      // Future dates check (in case maxDay logic is somehow bypassed)
      if (iterStr > todayStr) continue;

      // "Today Not Mention should not become Absent before day ends."
      if (iterStr === todayStr && (status === 'Not Mention' || !status)) {
        continue;
      }

      eligibleDays++;

      if (status === 'Present' || status === 'Late' || status === 'Work From Home') {
        attendedDays += 1;
        if (status === 'Present' || status === 'Work From Home') presentDays++;
        if (status === 'Late') lateDays++;
        if (isWfh) wfhDays++;
      } else if (status === 'Half Day') {
        attendedDays += 0.5;
        halfDays++;
      }
      // Absent or past 'Not Mention' adds 0 to attendedDays
    }

    const attendanceRate = eligibleDays > 0 ? Math.round((attendedDays / eligibleDays) * 100) : 0;

    const dashboardStats = {
      presentDays,
      lateDays,
      halfDays,
      wfhDays,
      attendedDays,
      eligibleDays,
      attendanceRate
    };

    res.json({
      success: true,
      attendance: result.rows,
      holidays: holidayResult.rows,
      dashboardStats
    });

  } catch (error) {
    console.error('Get monthly attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin: Get all attendance
const getAllAttendance = async (req, res) => {
  try {
    const { date, status, employee_id } = req.query;
    const targetDate = date || getLocalDateString(); // Use local date instead of UTC

    // Ensure daily attendance records exist for the target date
    await ensureDailyAttendanceRecords(targetDate);

    let query = `
      SELECT a.*, e.employee_id as emp_id, e.name, e.mobile, 
             d.name as department, e.job_role
      FROM employees e
      LEFT JOIN attendance a ON a.employee_id = e.employee_id AND a.attendance_date = $1
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.status = 'Active'
    `;
    const values = [targetDate];
    let paramCount = 2;

    if (status) {
      // Special filter: "Currently Working" - checked in but not checked out
      if (status === 'Currently Working') {
        query += ` AND a.login_time IS NOT NULL AND a.logout_time IS NULL`;
      }
      // If filtering for "Present", include both "Present" and "Work From Home"
      else if (status === 'Present') {
        query += ` AND a.attendance_status IN ('Present', 'Work From Home')`;
      } else if (status === 'Absent') {
        query += ` AND a.attendance_status = 'Absent'`;
      } else if (status === 'Not Mention' || status === 'No Record') {
        query += ` AND (a.attendance_status = 'Not Mention' OR a.attendance_status IS NULL)`;
      } else {
        query += ` AND a.attendance_status = $${paramCount}`;
        values.push(status);
        paramCount++;
      }
    }

    if (employee_id) {
      query += ` AND e.employee_id ILIKE $${paramCount}`;
      values.push(`%${employee_id}%`);
      paramCount++;
    }

    query += ' ORDER BY e.employee_id ASC';

    const result = await pool.query(query, values);

    const settings = await getSettingsFromDB();
    const officeTimes = getOfficeTimes(settings);
    const lateTimeInMinutes = officeTimes.lateTime;
    const endTimeInMinutes = officeTimes.endTime;

    const formattedAttendance = result.rows.map(row => {
      let r = { ...row };
      
      // Fix missing late_minutes if status is Late
      if (r.attendance_status === 'Late' && (!r.late_minutes || r.late_minutes === 0) && r.login_time) {
        const loginTimeInMinutes = getLocalMinutesFromUTC(r.login_time);
        if (loginTimeInMinutes > lateTimeInMinutes) {
          r.late_minutes = loginTimeInMinutes - lateTimeInMinutes;
          r.checkin_status = 'late';
        }
      }

      // Fix missing early_minutes if they checked out early
      if (r.logout_time && (!r.early_minutes || r.early_minutes === 0)) {
        const logoutTimeInMinutes = getLocalMinutesFromUTC(r.logout_time);
        if (logoutTimeInMinutes > 0 && logoutTimeInMinutes < endTimeInMinutes) {
          r.early_minutes = endTimeInMinutes - logoutTimeInMinutes;
          r.checkout_status = 'early';
        }
      }

      return r;
    });

    res.json({
      success: true,
      attendance: formattedAttendance
    });

  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin: Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const today = getLocalDateString(); // Use local date instead of UTC

    // Total employees
    const totalEmployees = await pool.query(
      "SELECT COUNT(*) FROM employees WHERE status = 'Active'"
    );

    // Present today
    const presentToday = await pool.query(
      `SELECT COUNT(*) FROM attendance 
       WHERE attendance_date = $1 AND login_time IS NOT NULL`,
      [today]
    );

    // Late employees
    const lateEmployees = await pool.query(
      `SELECT COUNT(*) FROM attendance 
       WHERE attendance_date = $1 AND attendance_status = 'Late'`,
      [today]
    );

    // WFH employees
    const wfhEmployees = await pool.query(
      `SELECT COUNT(*) FROM attendance 
       WHERE attendance_date = $1 AND is_wfh = true`,
      [today]
    );

    // Currently working (logged in but not logged out)
    const currentlyWorking = await pool.query(
      `SELECT COUNT(*) FROM attendance 
       WHERE attendance_date = $1 AND login_time IS NOT NULL AND logout_time IS NULL`,
      [today]
    );

    const totalEmp = parseInt(totalEmployees.rows[0].count);
    const presentEmp = parseInt(presentToday.rows[0].count);
    const absentEmp = totalEmp - presentEmp;

    res.json({
      success: true,
      stats: {
        totalEmployees: totalEmp,
        presentToday: presentEmp,
        lateEmployees: parseInt(lateEmployees.rows[0].count),
        wfhEmployees: parseInt(wfhEmployees.rows[0].count),
        absentEmployees: absentEmp,
        currentlyWorking: parseInt(currentlyWorking.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin: Get absent employees list
const getAbsentEmployees = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || getLocalDateString(); // Use local date instead of UTC

    // Get all active employees who haven't checked in on the target date
    const result = await pool.query(
      `SELECT e.id, e.employee_id, e.name, e.mobile, e.email, e.job_role,
              d.name as department
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN attendance a ON e.employee_id = a.employee_id AND a.attendance_date = $1
       WHERE e.status = 'Active' 
       AND (a.id IS NULL OR a.login_time IS NULL)
       ORDER BY e.employee_id`,
      [targetDate]
    );

    res.json({
      success: true,
      absentEmployees: result.rows,
      date: targetDate
    });

  } catch (error) {
    console.error('Get absent employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin: Reset attendance (allow employee to check-in/check-out again)
const resetAttendance = async (req, res) => {
  try {
    const { attendanceId, resetType } = req.body;

    if (!attendanceId || !resetType) {
      return res.status(400).json({
        success: false,
        message: 'Attendance ID and reset type are required'
      });
    }

    let result;
    if (resetType === 'check-in') {
      // Reset check-in: clear login data
      result = await pool.query(
        `UPDATE attendance 
         SET login_time = NULL,
             latitude_login = NULL,
             longitude_login = NULL,
             address_login = NULL,
             attendance_status = 'Absent',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [attendanceId]
      );
    } else if (resetType === 'check-out') {
      // Reset check-out: clear logout data
      result = await pool.query(
        `UPDATE attendance 
         SET logout_time = NULL,
             latitude_logout = NULL,
             longitude_logout = NULL,
             address_logout = NULL,
             total_working_hours = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [attendanceId]
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset type'
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.json({
      success: true,
      message: `${resetType} reset successful`,
      attendance: result.rows[0]
    });

  } catch (error) {
    console.error('Reset attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin: Delete attendance record
const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM attendance WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Log admin activity
    const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
    const { getClientIP } = require('../services/networkValidationService');
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.DELETE_ATTENDANCE,
      moduleName: MODULE_NAMES.ATTENDANCE,
      description: `Deleted attendance record for employee ${result.rows[0].employee_id} on ${result.rows[0].attendance_date}`,
      oldData: { 
        employee_id: result.rows[0].employee_id, 
        attendance_date: result.rows[0].attendance_date,
        attendance_status: result.rows[0].attendance_status
      },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Attendance record deleted successfully'
    });

  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Admin: Toggle early checkout permission for employee
const toggleEarlyCheckout = async (req, res) => {
  try {
    const { employeeId, enabled } = req.body;
    const adminId = req.user.id;

    if (!employeeId || enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and enabled status are required'
      });
    }

    // Get employee name
    const employeeResult = await pool.query(
      'SELECT name FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    const employeeName = employeeResult.rows.length > 0 ? employeeResult.rows[0].name : '';

    // Check if permission record exists
    const existingPermission = await pool.query(
      'SELECT * FROM early_checkout_permissions WHERE employee_id = $1',
      [employeeId]
    );

    let result;
    if (existingPermission.rows.length > 0) {
      // Update existing permission
      result = await pool.query(
        `UPDATE early_checkout_permissions 
         SET is_enabled = $1, enabled_by = $2, enabled_at = CURRENT_TIMESTAMP
         WHERE employee_id = $3
         RETURNING *`,
        [enabled, adminId, employeeId]
      );
    } else {
      // Insert new permission
      result = await pool.query(
        `INSERT INTO early_checkout_permissions (employee_id, is_enabled, enabled_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [employeeId, enabled, adminId]
      );
    }

    // Log activity
    const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
    const { getClientIP } = require('../services/networkValidationService');
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: enabled ? ADMIN_ACTION_TYPES.GRANT_EARLY_CHECKOUT : ADMIN_ACTION_TYPES.REVOKE_EARLY_CHECKOUT,
      moduleName: MODULE_NAMES.PERMISSIONS,
      description: `${enabled ? 'Granted' : 'Revoked'} early checkout permission ${enabled ? 'to' : 'from'} ${employeeId} - ${employeeName}`,
      newData: { employeeId, employeeName, is_enabled: enabled },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `Early checkout permission ${enabled ? 'enabled' : 'disabled'} successfully`,
      permission: result.rows[0]
    });

  } catch (error) {
    console.error('Toggle early checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getEmployeeMonthlyAttendance,
  getAllAttendance,
  getDashboardStats,
  getAbsentEmployees,
  resetAttendance,
  deleteAttendance,
  toggleEarlyCheckout,
  ensureDailyAttendanceRecords
};
