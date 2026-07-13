const fs = require('fs');
const path = require('path');

const controllerPath = path.resolve('c:/Project-attendance/backend/controllers/attendanceController.js');
let content = fs.readFileSync(controllerPath, 'utf8');

// The new checkOut implementation
const newCheckOut = `// Employee Check-out (Logout)
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
      deviceValidation.fingerprint = \`electron-\${electronPublicKeyHash}\`;
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

      const deviceResult = await pool.query(\`SELECT * FROM trusted_devices WHERE employee_id = $1 AND desktop_public_key_hash = $2 AND device_source = 'electron-desktop'\`, [employeeCode, electronPublicKeyHash]);
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

    // Check if current time is before office end time
    if (!hasEarlyCheckoutPermission) {
      // Get current time in IST (UTC+5:30)
      const currentTime = new Date();
      const istOffset = 5.5 * 60; // IST is UTC+5:30 in minutes
      const localTime = new Date(currentTime.getTime() + (istOffset * 60 * 1000));
      const currentHour = localTime.getUTCHours();
      const currentMinute = localTime.getUTCMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      const [endHour, endMinute] = settings.workingHours.officeEndTime.split(':').map(Number);
      const endTimeInMinutes = endHour * 60 + endMinute;

      console.log('=== CHECK-OUT TIME VALIDATION ===');
      console.log('System Time:', currentTime.toISOString());
      console.log('IST Time:', localTime.toISOString());
      console.log('Current Hour:', currentHour, 'Minute:', currentMinute);
      console.log('Current Time (minutes):', currentTimeInMinutes);
      console.log('Office End Time:', settings.workingHours.officeEndTime);
      console.log('Office End Time (minutes):', endTimeInMinutes);
      console.log('Has Early Checkout Permission:', hasEarlyCheckoutPermission);

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
            currentTime: \`\${currentHour}:\${currentMinute}\`,
            officeEndTime: settings.workingHours.officeEndTime
          }
        });
        
        return res.status(403).json({
          success: false,
          errorCode: 'EARLY_CHECKOUT',
          message: \`Check-out is not allowed before office end time (\${format24To12Hour(settings.workingHours.officeEndTime)}). Contact admin for early checkout permission.\`
        });
      }
      
      console.log('✅ Check-out ALLOWED - After office end time');
    } else {
      console.log('✅ Check-out ALLOWED - Has early checkout permission');
    }

    // Calculate working hours
    const loginTime = new Date(attendance.login_time);
    const logoutTime = new Date();
    const workingHours = ((logoutTime - loginTime) / (1000 * 60 * 60)).toFixed(2);

    // Update attendance status based on working hours (from database)
    const halfDayThreshold = settings.workingHours.halfDayThreshold;
    let finalStatus = attendance.attendance_status;
    if (parseFloat(workingHours) < halfDayThreshold) {
      finalStatus = 'Half Day';
    }

    // Update attendance (include device fingerprint and validation method from checkout)
    const result = await pool.query(
      \`UPDATE attendance 
       SET logout_time = CURRENT_TIMESTAMP,
           latitude_logout = $1,
           longitude_logout = $2,
           address_logout = $3,
           total_working_hours = $4,
           attendance_status = $5,
           device_fingerprint = COALESCE($8, device_fingerprint),
           validation_method = COALESCE($9, validation_method),
           updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = $6 AND attendance_date = $7
       RETURNING *\`,
      [latitude, longitude, address, workingHours, finalStatus, employeeCode, today,
       deviceValidation.fingerprint || null,
       validationMethod]
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
};`;

const startIdx = content.indexOf('// Employee Check-out (Logout)');
const endIdx = content.indexOf('// Get today\'s attendance for employee');

if (startIdx !== -1 && endIdx !== -1) {
  const updatedContent = content.substring(0, startIdx) + newCheckOut + '\\n\\n' + content.substring(endIdx);
  fs.writeFileSync(controllerPath, updatedContent);
  console.log('Successfully replaced checkOut logic!');
} else {
  console.log('Could not find bounds for checkOut function.');
}
