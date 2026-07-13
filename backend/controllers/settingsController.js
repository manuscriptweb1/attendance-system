const pool = require('../config/database');
const { clearSettingsCache } = require('../utils/settingsHelper');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

// Get current settings from database
const getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY id LIMIT 1');
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found. Please run migration first.'
      });
    }

    const dbSettings = result.rows[0];
    
    // Format response to match frontend expectations
    const settings = {
      companyLocation: {
        name: dbSettings.company_name,
        latitude: parseFloat(dbSettings.latitude),
        longitude: parseFloat(dbSettings.longitude),
        allowedRadius: dbSettings.allowed_radius,
        gpsAccuracyThreshold: dbSettings.gps_accuracy_threshold
      },
      workingHours: {
        lateAfterTime: dbSettings.late_after_time.substring(0, 5),  // Format: HH:MM
        halfDayThreshold: parseFloat(dbSettings.half_day_threshold),
        officeStartTime: dbSettings.office_start_time.substring(0, 5),  // Format: HH:MM
        officeEndTime: dbSettings.office_end_time.substring(0, 5),  // Format: HH:MM
        autoCheckoutTime: dbSettings.auto_checkout_time ? dbSettings.auto_checkout_time.substring(0, 5) : '18:32',  // Format: HH:MM
        checkInEnabled: dbSettings.check_in_enabled,
        checkOutEnabled: dbSettings.check_out_enabled
      },
      network: {
        officePublicIP: dbSettings.office_public_ip || '',
        allowedIPs: dbSettings.allowed_ips || ''
      },
      validation: {
        attendanceValidationMode: dbSettings.attendance_validation_mode || 'location_or_network'
      },
      security: {
        attendanceRateLimit: dbSettings.attendance_rate_limit || 5
      },
      trustedDevice: {
        validationEnabled: dbSettings.trusted_device_validation_enabled || false
      },
      electronDesktop: {
        enabled: dbSettings.electron_desktop_enabled !== false,
        validationMode: dbSettings.electron_desktop_validation_mode || 'trusted_device_and_network'
      },
      messages: {
        locationPermissionTitle: "Location Permission Required",
        locationPermissionMessage: "This app needs access to your location to verify your attendance. Please allow location access to continue.",
        locationDeniedTitle: "Location Access Denied",
        locationDeniedMessage: "You have denied location access. Please enable location permission in your browser settings to use attendance features.",
        locationUnavailableTitle: "Location Unavailable",
        locationUnavailableMessage: "Unable to retrieve your location. Please check if GPS is enabled on your device.",
        locationTimeoutTitle: "Location Timeout",
        locationTimeoutMessage: "Location request timed out. Please try again.",
        outsideRadiusTitle: "Outside Office Area",
        outsideRadiusMessage: "You are outside the allowed office area. Please move closer to the office to check in.",
        lowAccuracyTitle: "Low GPS Accuracy",
        lowAccuracyMessage: "GPS accuracy is too low. Please enable high accuracy mode in your device settings."
      }
    };

    res.json({
      success: true,
      settings: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading settings'
    });
  }
};

// Update settings in database
const updateSettings = async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      allowedRadius,
      gpsAccuracyThreshold,
      lateAfterTime,
      officeStartTime,
      officeEndTime,
      autoCheckoutTime,
      checkInEnabled,
      checkOutEnabled,
      halfDayThreshold,
      officePublicIP,
      allowedIPs,
      attendanceValidationMode,
      attendanceRateLimit,
      trustedDeviceValidationEnabled,
      electronDesktopEnabled,
      electronDesktopValidationMode
    } = req.body;

    // Validation
    if (!latitude || !longitude || !allowedRadius || !lateAfterTime) {
      return res.status(400).json({
        success: false,
        message: 'Required fields are missing'
      });
    }

    // Validate latitude (-90 to 90)
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be between -90 and 90'
      });
    }

    // Validate longitude (-180 to 180)
    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Longitude must be between -180 and 180'
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(lateAfterTime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid late time format. Use HH:MM (24-hour format)'
      });
    }

    if (officeStartTime && !timeRegex.test(officeStartTime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid office start time format. Use HH:MM (24-hour format)'
      });
    }

    if (officeEndTime && !timeRegex.test(officeEndTime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid office end time format. Use HH:MM (24-hour format)'
      });
    }

    if (autoCheckoutTime && !timeRegex.test(autoCheckoutTime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid auto-checkout time format. Use HH:MM (24-hour format)'
      });
    }

    // Validate validation mode
    const validModes = ['location_only', 'network_only', 'location_or_network', 'location_and_network'];
    if (attendanceValidationMode && !validModes.includes(attendanceValidationMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance validation mode'
      });
    }

    const validElectronModes = [
      'trusted_device_only', 'network_only', 'trusted_device_or_network',
      'trusted_device_and_network', 'location_only', 'location_and_trusted_device',
      'location_and_network', 'location_and_trusted_device_and_network'
    ];
    if (electronDesktopValidationMode && !validElectronModes.includes(electronDesktopValidationMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid electron desktop validation mode'
      });
    }

    // Update settings in database
    const updateQuery = `
      UPDATE settings SET
        latitude = $1,
        longitude = $2,
        allowed_radius = $3,
        gps_accuracy_threshold = $4,
        late_after_time = $5,
        office_start_time = $6,
        office_end_time = $7,
        auto_checkout_time = $8,
        check_in_enabled = $9,
        check_out_enabled = $10,
        half_day_threshold = $11,
        office_public_ip = $12,
        allowed_ips = $13,
        attendance_validation_mode = $14,
        attendance_rate_limit = $15,
        trusted_device_validation_enabled = $16,
        electron_desktop_enabled = $17,
        electron_desktop_validation_mode = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM settings ORDER BY id LIMIT 1)
      RETURNING *
    `;

    const values = [
      parseFloat(latitude),
      parseFloat(longitude),
      parseInt(allowedRadius),
      gpsAccuracyThreshold ? parseInt(gpsAccuracyThreshold) : 100,
      lateAfterTime,
      officeStartTime || '09:00',
      officeEndTime || '18:00',
      autoCheckoutTime || '18:32',
      checkInEnabled !== undefined ? checkInEnabled : true,
      checkOutEnabled !== undefined ? checkOutEnabled : true,
      halfDayThreshold ? parseFloat(halfDayThreshold) : 4.0,
      officePublicIP || null,
      allowedIPs || null,
      attendanceValidationMode || 'location_or_network',
      attendanceRateLimit ? parseInt(attendanceRateLimit) : 5,
      trustedDeviceValidationEnabled !== undefined ? trustedDeviceValidationEnabled : false,
      electronDesktopEnabled !== undefined ? electronDesktopEnabled : true,
      electronDesktopValidationMode || 'trusted_device_and_network'
    ];

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found. Please run migration first.'
      });
    }

    // Clear settings cache so next request gets fresh data
    clearSettingsCache();

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_SETTINGS,
      moduleName: MODULE_NAMES.SETTINGS,
      description: 'Updated system settings',
      newData: { 
        latitude, longitude, allowedRadius, officeStartTime, officeEndTime,
        attendanceValidationMode, trustedDeviceValidationEnabled,
        electronDesktopEnabled, electronDesktopValidationMode
      },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        companyLocation: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          allowedRadius: parseInt(allowedRadius),
          gpsAccuracyThreshold: gpsAccuracyThreshold ? parseInt(gpsAccuracyThreshold) : 100
        },
        workingHours: {
          lateAfterTime,
          officeStartTime,
          officeEndTime,
          autoCheckoutTime,
          checkInEnabled,
          checkOutEnabled,
          halfDayThreshold
        },
        network: {
          officePublicIP,
          allowedIPs
        },
        validation: {
          attendanceValidationMode
        },
        security: {
          attendanceRateLimit
        },
        trustedDevice: {
          validationEnabled: trustedDeviceValidationEnabled
        },
        electronDesktop: {
          enabled: electronDesktopEnabled !== undefined ? electronDesktopEnabled : true,
          validationMode: electronDesktopValidationMode || 'trusted_device_and_network'
        }
      }
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings'
    });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
