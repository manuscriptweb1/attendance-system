const pool = require('../config/database');

// Cache settings in memory to avoid frequent DB queries
let cachedSettings = null;
let lastFetch = null;
const CACHE_DURATION = 60000; // 1 minute

// Get settings from database (with caching)
async function getSettingsFromDB() {
  try {
    // Return cached settings if still valid
    const now = Date.now();
    if (cachedSettings && lastFetch && (now - lastFetch < CACHE_DURATION)) {
      return cachedSettings;
    }

    // Fetch from database
    const result = await pool.query('SELECT * FROM settings ORDER BY id LIMIT 1');
    
    if (result.rows.length === 0) {
      throw new Error('Settings not found in database. Please run migration.');
    }

    const dbSettings = result.rows[0];
    
    // Format to match old settings.json structure for backward compatibility
    cachedSettings = {
      companyLocation: {
        name: dbSettings.company_name,
        latitude: parseFloat(dbSettings.latitude),
        longitude: parseFloat(dbSettings.longitude),
        allowedRadius: dbSettings.allowed_radius,
        gpsAccuracyThreshold: dbSettings.gps_accuracy_threshold
      },
      workingHours: {
        lateAfterTime: dbSettings.late_after_time ? dbSettings.late_after_time.substring(0, 5) : '09:30',
        halfDayThreshold: parseFloat(dbSettings.half_day_threshold),
        officeStartTime: dbSettings.office_start_time ? dbSettings.office_start_time.substring(0, 5) : '09:00',
        officeEndTime: dbSettings.office_end_time ? dbSettings.office_end_time.substring(0, 5) : '18:00',
        checkInEnabled: dbSettings.check_in_enabled,
        checkOutEnabled: dbSettings.check_out_enabled
      },
      shiftSettings: {
        morningShiftStartTime: dbSettings.morning_shift_start_time ? dbSettings.morning_shift_start_time.substring(0, 5) : '09:30',
        morningLateAfterTime: dbSettings.morning_late_after_time ? dbSettings.morning_late_after_time.substring(0, 5) : '09:45',
        morningShiftEndTime: dbSettings.morning_shift_end_time ? dbSettings.morning_shift_end_time.substring(0, 5) : '13:30',
        lunchStartTime: dbSettings.lunch_start_time ? dbSettings.lunch_start_time.substring(0, 5) : '13:30',
        lunchEndTime: dbSettings.lunch_end_time ? dbSettings.lunch_end_time.substring(0, 5) : '14:00',
        eveningShiftStartTime: dbSettings.evening_shift_start_time ? dbSettings.evening_shift_start_time.substring(0, 5) : '14:00',
        eveningLateAfterTime: dbSettings.evening_late_after_time ? dbSettings.evening_late_after_time.substring(0, 5) : '14:00',
        eveningShiftEndTime: dbSettings.evening_shift_end_time ? dbSettings.evening_shift_end_time.substring(0, 5) : '17:30'
      },
      network: {
        officePublicIP: dbSettings.office_public_ip,
        allowedIPs: dbSettings.allowed_ips ? dbSettings.allowed_ips.split(',').map(ip => ip.trim()) : []
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
      }
    };

    lastFetch = now;
    return cachedSettings;
  } catch (error) {
    console.error('Error fetching settings from database:', error);
    throw error;
  }
}

// Clear settings cache (call this after updating settings)
function clearSettingsCache() {
  cachedSettings = null;
  lastFetch = null;
}

module.exports = {
  getSettingsFromDB,
  clearSettingsCache
};
