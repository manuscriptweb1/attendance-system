const { getSettingsFromDB } = require('./settingsHelper');
const { validateLocation, validateGPSAccuracy } = require('./locationValidator');
const { validateNetwork } = require('../services/networkValidationService');
const { parseTime } = require('./timeUtils');

/**
 * Validate attendance based on configured mode
 */
const validateAttendance = async (req, latitude, longitude, accuracy, isWFH = false) => {
  try {
    // If WFH is enabled, skip all validation
    if (isWFH) {
      console.log('✅ WFH enabled - skipping all validation');
      return {
        valid: true,
        method: 'wfh',
        message: 'WFH enabled - validation skipped'
      };
    }

    const settings = await getSettingsFromDB();
    const validationMode = settings.validation.attendanceValidationMode;

    console.log('=== ATTENDANCE VALIDATION START ===');
    console.log('Validation Mode:', validationMode);
    console.log('GPS Accuracy Threshold:', settings.companyLocation.gpsAccuracyThreshold, 'meters');
    console.log('Allowed Radius:', settings.companyLocation.allowedRadius, 'meters');
    console.log('Received GPS Accuracy:', accuracy, 'meters');

    // Perform location validation
    let locationValid = false;
    let locationMessage = '';
    let locationDistance = null;
    let accuracyInfo = null;

    // Check GPS accuracy first
    const accuracyCheck = await validateGPSAccuracy(accuracy);
    accuracyInfo = {
      accuracy: accuracyCheck.accuracy,
      threshold: accuracyCheck.threshold
    };
    
    if (!accuracyCheck.valid) {
      console.log('❌ GPS accuracy validation FAILED:', accuracyCheck.message);
      locationValid = false;
      locationMessage = accuracyCheck.message;
    } else {
      console.log('✅ GPS accuracy validation PASSED');
      // GPS accuracy is acceptable, check location
      const locationCheck = await validateLocation(
        parseFloat(latitude),
        parseFloat(longitude),
        false
      );
      locationValid = locationCheck.valid;
      locationMessage = locationCheck.message;
      locationDistance = locationCheck.distance;
      
      console.log(locationValid ? '✅ Location validation PASSED' : '❌ Location validation FAILED');
    }

    // Perform network validation
    const networkCheck = await validateNetwork(req);
    const networkValid = networkCheck.valid;
    const networkMessage = networkCheck.message;

    console.log('Network Valid:', networkValid, '-', networkMessage);
    console.log('=== VALIDATION RESULTS ===');
    console.log('Location Valid:', locationValid);
    console.log('Network Valid:', networkValid);
    console.log('Mode:', validationMode);

    // Apply validation mode
    switch (validationMode) {
      case 'location_only':
        console.log('Applying MODE: location_only');
        if (locationValid) {
          console.log('✅ VALIDATION PASSED (location_only)');
          return {
            valid: true,
            method: 'location',
            message: 'Location validation passed',
            distance: locationDistance,
            accuracyInfo
          };
        } else {
          console.log('❌ VALIDATION FAILED (location_only)');
          return {
            valid: false,
            method: 'location',
            message: `Location Validation Failed: ${locationMessage}`,
            distance: locationDistance,
            accuracyInfo
          };
        }

      case 'network_only':
        console.log('Applying MODE: network_only');
        if (networkValid) {
          console.log('✅ VALIDATION PASSED (network_only)');
          return {
            valid: true,
            method: 'network',
            message: 'Network validation passed',
            accuracyInfo
          };
        } else {
          console.log('❌ VALIDATION FAILED (network_only)');
          return {
            valid: false,
            method: 'network',
            message: `Network Validation Failed: ${networkMessage}`,
            accuracyInfo
          };
        }

      case 'location_or_network':
        console.log('Applying MODE: location_or_network');
        // Pass if EITHER location OR network is valid
        if (locationValid || networkValid) {
          const method = locationValid ? 'location' : 'network';
          const message = locationValid ? 
            `Location validation passed${networkValid ? ' (network also valid)' : ''}` :
            'Network validation passed (location failed but not required)';
          
          console.log('✅ VALIDATION PASSED (location_or_network) - Method:', method);
          return {
            valid: true,
            method: locationValid && networkValid ? 'location_and_network' : method,
            message,
            distance: locationDistance,
            accuracyInfo
          };
        } else {
          console.log('❌ VALIDATION FAILED (location_or_network) - Both failed');
          return {
            valid: false,
            method: 'location_or_network',
            message: `Validation Failed (Both Required):\n• Location: ${locationMessage}\n• Network: ${networkMessage}`,
            distance: locationDistance,
            accuracyInfo
          };
        }

      case 'location_and_network':
        console.log('Applying MODE: location_and_network');
        // Pass only if BOTH location AND network are valid
        if (locationValid && networkValid) {
          console.log('✅ VALIDATION PASSED (location_and_network) - Both passed');
          return {
            valid: true,
            method: 'location_and_network',
            message: 'Both location and network validation passed',
            distance: locationDistance,
            accuracyInfo
          };
        } else {
          const failedChecks = [];
          if (!locationValid) {
            failedChecks.push(`Location: ${locationMessage}`);
            console.log('❌ Location validation failed');
          }
          if (!networkValid) {
            failedChecks.push(`Network: ${networkMessage}`);
            console.log('❌ Network validation failed');
          }
          
          console.log('❌ VALIDATION FAILED (location_and_network)');
          return {
            valid: false,
            method: 'location_and_network',
            message: `Validation Failed (Both Required):\n• ${failedChecks.join('\n• ')}`,
            distance: locationDistance,
            accuracyInfo
          };
        }

      default:
        console.log('Applying MODE: default (location_or_network)');
        // Default to location_or_network
        if (locationValid || networkValid) {
          const method = locationValid ? 'location' : 'network';
          console.log('✅ VALIDATION PASSED (default) - Method:', method);
          return {
            valid: true,
            method,
            message: `${method.charAt(0).toUpperCase() + method.slice(1)} validation passed`,
            distance: locationDistance,
            accuracyInfo
          };
        } else {
          console.log('❌ VALIDATION FAILED (default)');
          return {
            valid: false,
            method: 'location_or_network',
            message: `Validation Failed:\n• Location: ${locationMessage}\n• Network: ${networkMessage}`,
            distance: locationDistance,
            accuracyInfo
          };
        }
    }
  } catch (error) {
    console.error('❌ Attendance validation error:', error);
    return {
      valid: false,
      method: 'error',
      message: 'Validation error occurred. Please try again.'
    };
  }
};

/**
 * Calculate attendance status based on time (backend only - never trust frontend)
 */
const calculateAttendanceStatus = async (isWFH) => {
  const settings = await getSettingsFromDB();
  
  // Get current time in IST (UTC+5:30)
  const currentTime = new Date();
  const istOffset = 5.5 * 60; // IST is UTC+5:30 in minutes
  const localTime = new Date(currentTime.getTime() + (istOffset * 60 * 1000));
  const currentHour = localTime.getUTCHours();
  const currentMinute = localTime.getUTCMinutes();

  const lateMinutesFromMidnight = parseTime(settings.workingHours.lateAfterTime);
  const lateHour = Math.floor(lateMinutesFromMidnight / 60);
  const lateMinute = lateMinutesFromMidnight % 60;
  
  let attendanceStatus = 'Present';
  
  // Check if late (applies to ALL employees, both office and WFH)
  if (currentHour > lateHour || (currentHour === lateHour && currentMinute > lateMinute)) {
    attendanceStatus = 'Late';
  }

  // Override with WFH status if employee has WFH permission and NOT late
  if (isWFH && attendanceStatus !== 'Late') {
    attendanceStatus = 'Work From Home';
  }

  return attendanceStatus;
};

module.exports = {
  validateAttendance,
  calculateAttendanceStatus
};
