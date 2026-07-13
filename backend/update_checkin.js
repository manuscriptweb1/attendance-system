const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Project-attendance/backend/controllers/attendanceController.js');
let content = fs.readFileSync(targetFile, 'utf8');

const startMarker = `    // === TRUSTED DEVICE VALIDATION ===`;
const endMarker = `    // === END TRUSTED DEVICE VALIDATION ===`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker) + endMarker.length;

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found.");
  process.exit(1);
}

const replacement = `    // Get employee name
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
        const deviceResult = await pool.query(\`SELECT * FROM trusted_devices WHERE employee_id = $1 AND desktop_public_key_hash = $2 AND device_source = 'electron-desktop'\`, [employeeCode, desktopPublicKeyHash]);
        if (deviceResult.rows.length === 0 || deviceResult.rows[0].approved_status !== 'Approved') {
          trustedDeviceError = { errorCode: 'DEVICE_APPROVAL_REQUIRED', message: 'This desktop device is not approved yet. Please wait for administrator approval.' };
        } else {
          trustedDeviceId = deviceResult.rows[0].id;
          deviceValidation = { valid: true, fingerprint: \`electron-\${desktopPublicKeyHash}\` };
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
          \`UPDATE attendance SET login_time = CURRENT_TIMESTAMP, latitude_login = $1, longitude_login = $2, address_login = $3, attendance_status = $4, is_wfh = $5, device_info = $6, browser_info = $7, ip_address = $8, gps_accuracy = $9, device_fingerprint = $10, validation_method = $11, session_id = $12, trusted_device_id = $13, device_source = $14, desktop_public_key_hash = $15, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $16 AND attendance_date = $17 RETURNING *\`,
          [latitude, longitude, address, attendanceStatus, isWFH, device_info, browser_info, clientIP, accuracy, deviceValidation.fingerprint || 'electron', electronMode, sessionId, trustedDeviceId, deviceSource, desktopPublicKeyHash, employeeCode, today]
        );
      } else {
        result = await pool.query(
          \`INSERT INTO attendance (employee_id, attendance_date, login_time, latitude_login, longitude_login, address_login, attendance_status, is_wfh, device_info, browser_info, ip_address, gps_accuracy, device_fingerprint, validation_method, session_id, trusted_device_id, device_source, desktop_public_key_hash) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *\`,
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
            \`UPDATE attendance SET login_time = CURRENT_TIMESTAMP, latitude_login = $1, longitude_login = $2, address_login = $3, attendance_status = $4, is_wfh = $5, device_info = $6, browser_info = $7, ip_address = $8, gps_accuracy = $9, device_fingerprint = $10, validation_method = $11, session_id = $12, trusted_device_id = $13, device_source = $14, desktop_public_key_hash = $15, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $16 AND attendance_date = $17 RETURNING *\`,
            [latitude, longitude, address, attendanceStatus, isWFH, device_info, browser_info, clientIP, accuracy, deviceValidation.fingerprint, 'trusted_device', sessionId, trustedDeviceId, deviceSource, desktopPublicKeyHash, employeeCode, today]
          );
        } else {
          result = await pool.query(
            \`INSERT INTO attendance (employee_id, attendance_date, login_time, latitude_login, longitude_login, address_login, attendance_status, is_wfh, device_info, browser_info, ip_address, gps_accuracy, device_fingerprint, validation_method, session_id, trusted_device_id, device_source, desktop_public_key_hash) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *\`,
            [employeeCode, today, latitude, longitude, address, attendanceStatus, isWFH, device_info, browser_info, clientIP, accuracy, deviceValidation.fingerprint, 'trusted_device', sessionId, trustedDeviceId, deviceSource, desktopPublicKeyHash]
          );
        }
        
        await logAudit({ userId: employeeCode, userType: 'employee', action: AUDIT_ACTIONS.CHECKIN_SUCCESS, status: AUDIT_STATUS.SUCCESS, ipAddress: clientIP, userAgent: req.headers['user-agent'], deviceFingerprint: deviceValidation.fingerprint, details: { attendanceStatus, validationMethod: 'trusted_device', isWFH, gpsAccuracy: accuracy } });
        
        return res.json({ success: true, message: 'Check-in successful (Trusted Device)', attendance: result.rows[0], validationMethod: 'trusted_device', sessionId });
      }
    }
    // === END TRUSTED DEVICE VALIDATION ===`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);

// Also remove the old WFH permission check
const wfhBlockStart = content.indexOf('    // Check WFH permission');
const wfhBlockEndStr = 'const isWFH = wfhResult.rows.length > 0 && wfhResult.rows[0].is_enabled;';
const wfhBlockEnd = content.indexOf(wfhBlockEndStr, wfhBlockStart) + wfhBlockEndStr.length;

if (wfhBlockStart !== -1 && wfhBlockEnd !== -1) {
    content = content.substring(0, wfhBlockStart) + content.substring(wfhBlockEnd);
}

fs.writeFileSync(targetFile, content);
console.log("Replaced successfully!");
