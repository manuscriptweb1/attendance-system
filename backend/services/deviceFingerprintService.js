const pool = require('../config/database');

/**
 * Generate device fingerprint from request
 */
const generateFingerprint = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  // Create a simple fingerprint (in production, use a proper fingerprinting library)
  const crypto = require('crypto');
  const fingerprintString = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
  const fingerprint = crypto.createHash('md5').update(fingerprintString).digest('hex');
  
  return fingerprint;
};

/**
 * Extract device info from user agent
 */
const parseDeviceInfo = (userAgent) => {
  let browser = 'Unknown';
  let browserVersion = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'Unknown';
  
  // Detect browser and version
  if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edg') === -1) {
    browser = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1) {
    browser = 'Safari';
    const match = userAgent.match(/Version\/(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.indexOf('Firefox') > -1) {
    browser = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.indexOf('Edg') > -1) {
    browser = 'Edge';
    const match = userAgent.match(/Edg\/(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) {
    browser = 'Internet Explorer';
    const match = userAgent.match(/(?:MSIE |rv:)(\d+\.\d+)/);
    if (match) browserVersion = match[1];
  }
  
  // Detect OS
  if (userAgent.indexOf('Windows') > -1) {
    os = 'Windows';
  } else if (userAgent.indexOf('Mac OS') > -1) {
    os = 'macOS';
  } else if (userAgent.indexOf('Linux') > -1) {
    os = 'Linux';
  } else if (userAgent.indexOf('Android') > -1) {
    os = 'Android';
  } else if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) {
    os = 'iOS';
  }
  
  // Detect device type
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'Mobile';
  } else if (/ipad|tablet|kindle|playbook|silk/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/macbook|laptop/i.test(ua)) {
    deviceType = 'Laptop';
  } else if (/windows|mac os|linux|x11/i.test(ua) && deviceType === 'Unknown') {
    deviceType = 'Desktop';
  }
  
  return { browser, browserVersion, os, deviceType };
};

/**
 * Log device fingerprint
 */
const logDeviceFingerprint = async (employeeId, req, additionalInfo = {}) => {
  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const fingerprint = generateFingerprint(req);
    const { browser, browserVersion, os, deviceType } = parseDeviceInfo(userAgent);
    
    const { screenResolution, timezone } = additionalInfo;
    
    // Check if device exists
    const existing = await pool.query(
      'SELECT * FROM device_fingerprints WHERE employee_id = $1 AND device_fingerprint = $2',
      [employeeId, fingerprint]
    );
    
    if (existing.rows.length > 0) {
      // Update last seen and device info
      await pool.query(
        `UPDATE device_fingerprints 
         SET last_seen_at = CURRENT_TIMESTAMP,
             browser = $1,
             browser_version = $2,
             operating_system = $3,
             device_type = $4,
             screen_resolution = COALESCE($5, screen_resolution),
             timezone = COALESCE($6, timezone)
         WHERE id = $7`,
        [browser, browserVersion, os, deviceType, screenResolution, timezone, existing.rows[0].id]
      );
    } else {
      // Insert new device
      await pool.query(
        `INSERT INTO device_fingerprints 
         (employee_id, device_fingerprint, browser, browser_version, operating_system, 
          device_type, screen_resolution, timezone, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [employeeId, fingerprint, browser, browserVersion, os, deviceType, 
         screenResolution || null, timezone || null, true]
      );
    }
    
    return {
      fingerprint,
      browser,
      browserVersion,
      os,
      deviceType,
      screenResolution,
      timezone
    };
  } catch (error) {
    console.error('Error logging device fingerprint:', error);
    // Don't throw - device fingerprinting is non-blocking
    return null;
  }
};

/**
 * Check if device is approved
 */
const isDeviceApproved = async (employeeId, fingerprint) => {
  try {
    const result = await pool.query(
      'SELECT is_approved FROM device_fingerprints WHERE employee_id = $1 AND device_fingerprint = $2',
      [employeeId, fingerprint]
    );
    
    if (result.rows.length === 0) {
      // New device - approve by default (for now)
      return true;
    }
    
    return result.rows[0].is_approved;
  } catch (error) {
    console.error('Error checking device approval:', error);
    // Default to approved if error
    return true;
  }
};

/**
 * Register or update trusted device
 */
const registerTrustedDevice = async (employeeId, employeeName, req, additionalInfo = {}) => {
  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const fingerprint = generateFingerprint(req);
    const { browser, browserVersion, os, deviceType } = parseDeviceInfo(userAgent);
    
    const { screenResolution, timezone } = additionalInfo;
    const platform = req.headers['sec-ch-ua-platform'] || os;
    
    // Check if device exists in trusted_devices
    const existing = await pool.query(
      'SELECT * FROM trusted_devices WHERE employee_id = $1 AND device_fingerprint = $2',
      [employeeId, fingerprint]
    );
    
    if (existing.rows.length > 0) {
      // Update last used
      await pool.query(
        `UPDATE trusted_devices 
         SET last_used = CURRENT_TIMESTAMP,
             employee_name = $1,
             browser_name = $2,
             browser_version = $3,
             operating_system = $4,
             device_type = $5,
             screen_resolution = COALESCE($6, screen_resolution),
             platform = COALESCE($7, platform)
         WHERE id = $8`,
        [employeeName, browser, browserVersion, os, deviceType, screenResolution, platform, existing.rows[0].id]
      );
      
      return { 
        fingerprint,
        device: existing.rows[0],
        isNew: false
      };
    } else {
      // Insert new device with Pending status
      const result = await pool.query(
        `INSERT INTO trusted_devices 
         (employee_id, employee_name, device_fingerprint, browser_name, browser_version, 
          operating_system, device_type, screen_resolution, platform, approved_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')
         RETURNING *`,
        [employeeId, employeeName, fingerprint, browser, browserVersion, os, deviceType, 
         screenResolution || null, platform]
      );
      
      return {
        fingerprint,
        device: result.rows[0],
        isNew: true
      };
    }
  } catch (error) {
    console.error('Error registering trusted device:', error);
    return null;
  }
};

/**
 * Check if device is approved for trusted device validation
 */
const isTrustedDeviceApproved = async (employeeId, fingerprint) => {
  try {
    const result = await pool.query(
      'SELECT approved_status FROM trusted_devices WHERE employee_id = $1 AND device_fingerprint = $2',
      [employeeId, fingerprint]
    );
    
    if (result.rows.length === 0) {
      // New device - not approved
      return { approved: false, status: 'Not Found', isNew: true };
    }
    
    const status = result.rows[0].approved_status;
    return { 
      approved: status === 'Approved', 
      status: status,
      isNew: false
    };
  } catch (error) {
    console.error('Error checking trusted device approval:', error);
    // Default to not approved if error
    return { approved: false, status: 'Error', isNew: false };
  }
};

/**
 * Validate Trusted Device
 * Returns validation result handling Blocked priority and settings
 */
const validateTrustedDevice = async (employeeId, employeeName, req, validationEnabled, additionalInfo = {}) => {
  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const fingerprint = generateFingerprint(req);
    const { browser, browserVersion, os, deviceType } = parseDeviceInfo(userAgent);
    
    const { screenResolution, timezone } = additionalInfo;
    const platform = req.headers['sec-ch-ua-platform'] || os;

    // Check if device exists in trusted_devices
    const existingCheck = await pool.query(
      'SELECT * FROM trusted_devices WHERE employee_id = $1 AND device_fingerprint = $2',
      [employeeId, fingerprint]
    );

    // 1. If device exists, ALWAYS check if it's Blocked first
    if (existingCheck.rows.length > 0) {
      const existingDevice = existingCheck.rows[0];
      
      // Update last used
      await pool.query(
        `UPDATE trusted_devices 
         SET last_used = CURRENT_TIMESTAMP,
             employee_name = $1,
             browser_name = $2,
             browser_version = $3,
             operating_system = $4,
             device_type = $5,
             screen_resolution = COALESCE($6, screen_resolution),
             platform = COALESCE($7, platform)
         WHERE id = $8`,
        [employeeName, browser, browserVersion, os, deviceType, screenResolution, platform, existingDevice.id]
      );

      // ALWAYS BLOCK IF DEVICE IS BLOCKED, REGARDLESS OF SETTINGS
      if (existingDevice.approved_status === 'Blocked') {
        return {
          valid: false,
          message: 'This device has been blocked by your administrator. Please contact your administrator.',
          deviceStatus: 'Blocked',
          requiresApproval: true,
          fingerprint,
          isNew: false
        };
      }
    }

    // 2. If validation is disabled and device isn't blocked, skip further checks
    if (!validationEnabled) {
      return { valid: true, fingerprint };
    }

    // 3. Validation is enabled.
    if (existingCheck.rows.length === 0) {
      // New device - register as pending
      await pool.query(
        `INSERT INTO trusted_devices 
         (employee_id, employee_name, device_fingerprint, browser_name, browser_version, 
          operating_system, device_type, screen_resolution, platform, approved_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')`,
        [employeeId, employeeName, fingerprint, browser, browserVersion, os, deviceType, 
         screenResolution || null, platform]
      );
      
      return {
        valid: false,
        message: 'Your device has been registered and is pending administrator approval. Please wait for approval before marking attendance.',
        deviceStatus: 'Pending',
        requiresApproval: true,
        isNewDevice: true,
        fingerprint
      };
    }

    const existingDevice = existingCheck.rows[0];
    
    // Check other statuses
    if (existingDevice.approved_status === 'Pending') {
      return {
        valid: false,
        message: 'Your device approval request is pending. Please wait for administrator approval.',
        deviceStatus: 'Pending',
        requiresApproval: true,
        fingerprint,
        isNewDevice: false
      };
    } else if (existingDevice.approved_status === 'Rejected') {
      return {
        valid: false,
        message: 'Your device has been rejected by the administrator. Please contact admin for access.',
        deviceStatus: 'Rejected',
        requiresApproval: true,
        rejectionReason: existingDevice.remarks,
        fingerprint,
        isNewDevice: false
      };
    } else if (existingDevice.approved_status === 'Approved') {
      return { valid: true, fingerprint, isNewDevice: false };
    } else {
      return {
        valid: false,
        message: 'Your device is not approved for attendance. Please contact the administrator.',
        deviceStatus: existingDevice.approved_status,
        requiresApproval: true,
        fingerprint,
        isNewDevice: false
      };
    }

  } catch (error) {
    console.error('Error validating trusted device:', error);
    throw error;
  }
};

module.exports = {
  generateFingerprint,
  parseDeviceInfo,
  logDeviceFingerprint,
  isDeviceApproved,
  registerTrustedDevice,
  isTrustedDeviceApproved,
  validateTrustedDevice
};
