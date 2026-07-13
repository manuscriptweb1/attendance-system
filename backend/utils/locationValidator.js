const { getSettingsFromDB } = require('./settingsHelper');

// Haversine Formula to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters
  return distance;
};

// Validate if employee is within allowed radius
const validateLocation = async (employeeLat, employeeLon, isWFH = false) => {
  console.log('=== BACKEND LOCATION VALIDATION ===');
  console.log('Employee Location:', { lat: employeeLat, lon: employeeLon });
  console.log('Is WFH:', isWFH);
  
  // If WFH is enabled, skip office location validation
  if (isWFH) {
    console.log('WFH enabled - skipping location validation');
    return {
      valid: true,
      distance: null,
      message: 'WFH enabled - location validation skipped'
    };
  }

  // Get location from database
  const settings = await getSettingsFromDB();
  const companyLat = settings.companyLocation.latitude;
  const companyLon = settings.companyLocation.longitude;
  const allowedRadius = settings.companyLocation.allowedRadius;

  console.log('Company Location (from database):', { lat: companyLat, lon: companyLon });
  console.log('Allowed Radius:', allowedRadius, 'meters');

  const distance = calculateDistance(
    companyLat,
    companyLon,
    employeeLat,
    employeeLon
  );

  console.log('Calculated Distance:', distance.toFixed(2), 'meters');

  if (distance <= allowedRadius) {
    console.log('✅ Within allowed radius');
    return {
      valid: true,
      distance: distance.toFixed(2),
      message: 'Within allowed radius'
    };
  } else {
    console.log('❌ Outside allowed radius');
    return {
      valid: false,
      distance: distance.toFixed(2),
      message: `Outside allowed radius. You are ${distance.toFixed(2)}m away from office.`
    };
  }
};

// Validate GPS Accuracy
const validateGPSAccuracy = async (accuracy) => {
  // Get threshold from database
  const settings = await getSettingsFromDB();
  const threshold = settings.companyLocation.gpsAccuracyThreshold;
  
  console.log('=== GPS ACCURACY VALIDATION ===');
  console.log('GPS Accuracy (from device):', accuracy, 'meters');
  console.log('GPS Accuracy Threshold (from database):', threshold, 'meters');
  console.log('Comparison:', accuracy, '>', threshold, '=', accuracy > threshold);
  
  if (accuracy > threshold) {
    console.log('❌ GPS accuracy check FAILED');
    return {
      valid: false,
      message: `GPS accuracy too low (${accuracy}m). Required: ${threshold}m or better. Please enable high accuracy mode or move to an open area.`,
      accuracy: accuracy,
      threshold: threshold
    };
  }
  
  console.log('✅ GPS accuracy check PASSED');
  return {
    valid: true,
    message: 'GPS accuracy acceptable',
    accuracy: accuracy,
    threshold: threshold
  };
};

module.exports = {
  calculateDistance,
  validateLocation,
  validateGPSAccuracy
};
