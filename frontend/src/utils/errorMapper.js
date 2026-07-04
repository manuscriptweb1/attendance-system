export const ERROR_ACTIONS = {
  OK: 'ok',
  RETRY: 'retry',
  CANCEL: 'cancel',
  SIGN_IN_AGAIN: 'signInAgain'
};

export const mapErrorToDialogConfig = (error) => {
  const status = error.response?.status;
  const data = error.response?.data || {};
  const message = (data.message || error.message || '').toLowerCase();
  
  // 7. No Internet Connection (Client offline)
  if (!navigator.onLine) {
    return {
      priority: 7,
      title: 'No Internet Connection',
      message: 'Your internet connection appears to be offline.\n\nPlease reconnect and try again.',
      buttons: [ERROR_ACTIONS.RETRY, ERROR_ACTIONS.CANCEL],
      icon: 'network'
    };
  }

  // 6. GPS Permission Denied (Frontend error from location utils)
  if (error.type === 'denied') {
    return {
      priority: 6,
      title: 'Location Permission Required',
      message: 'Location access is required to complete attendance.\n\nPlease enable location permission and try again.',
      buttons: [ERROR_ACTIONS.RETRY, ERROR_ACTIONS.CANCEL],
      icon: 'location'
    };
  }
  if (error.type === 'unavailable' || error.type === 'timeout') {
    return {
      priority: 6,
      title: 'Location Verification Failed',
      message: 'Unable to retrieve your location.\n\nPlease ensure your GPS is active and try again.',
      buttons: [ERROR_ACTIONS.RETRY, ERROR_ACTIONS.CANCEL],
      icon: 'location'
    };
  }

  // 8. Server Unavailable (Backend offline)
  if ((status >= 502 && status <= 504) || error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return {
      priority: 8,
      title: 'Service Temporarily Unavailable',
      message: 'The Attendance server is currently unavailable.\n\nPlease try again in a few minutes.',
      buttons: [ERROR_ACTIONS.RETRY, ERROR_ACTIONS.CANCEL],
      icon: 'server'
    };
  }

  // 2. Session Expired / Authentication Token Missing
  if (status === 401 && (message.includes('token') || message.includes('access denied'))) {
    const isAdmin = window.location.pathname.includes('/admin');
    return {
      priority: 2,
      title: 'Session Expired',
      message: isAdmin 
        ? 'Your login session has expired.\n\nPlease sign in again.'
        : 'Your login session has expired or your browser data has been cleared.\n\nPlease sign in again using the same device that you used for Check-In.',
      buttons: [ERROR_ACTIONS.SIGN_IN_AGAIN, ERROR_ACTIONS.CANCEL],
      icon: 'auth'
    };
  }

  // 2. Invalid JWT
  if (status === 401 && (message.includes('jwt') || message.includes('invalid') || message.includes('malformed') || message.includes('expired'))) {
    return {
      priority: 2,
      title: 'Authentication Required',
      message: 'Your login session is no longer valid.\n\nPlease sign in again to continue.',
      buttons: [ERROR_ACTIONS.SIGN_IN_AGAIN, ERROR_ACTIONS.CANCEL],
      icon: 'auth'
    };
  }

  // 1. Attendance Session Missing/Mismatch
  if (status === 403 && data.sessionInvalid) {
    if (message.includes('found')) { 
       return {
        priority: 1,
        title: 'Attendance Session Not Found',
        message: 'Your attendance session could not be found.\n\nPlease contact your administrator if this issue continues.',
        buttons: [ERROR_ACTIONS.OK],
        icon: 'session'
      };
    }
    return {
      priority: 1,
      title: 'Attendance Session Invalid',
      message: 'Your attendance session is no longer valid.\n\nPlease sign in again using the same device used during Check-In.',
      buttons: [ERROR_ACTIONS.SIGN_IN_AGAIN, ERROR_ACTIONS.CANCEL],
      icon: 'session'
    };
  }

  // Electron Desktop Specific Validation Errors
  if (data.errorCode === 'ELECTRON_ATTENDANCE_DISABLED') {
    return {
      priority: 3,
      title: 'Desktop Check-in Disabled',
      message: data.message || 'Check-in via the Electron Desktop App is currently disabled by your administrator. Please use the web or mobile app.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'DESKTOP_GPS_NOT_AVAILABLE') {
    return {
      priority: 6,
      title: 'Desktop GPS Unavailable',
      message: data.message || 'Unable to retrieve location on this desktop. Please ensure location services are enabled, or ask your administrator to configure a different validation mode for Desktop.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'location'
    };
  }

  if (data.errorCode === 'ELECTRON_TRUSTED_DEVICE_REQUIRED') {
    return {
      priority: 4,
      title: 'Approved Desktop Required',
      message: data.message || 'This validation mode requires an approved Electron desktop device. Please request approval from your administrator.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'ELECTRON_NETWORK_VALIDATION_FAILED') {
    return {
      priority: 6,
      title: 'Desktop Network Validation Failed',
      message: data.message || 'You must be connected to the office network to check in via the Desktop App.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'network'
    };
  }

  if (data.errorCode === 'ELECTRON_LOCATION_REQUIRED' || data.errorCode === 'ELECTRON_LOCATION_VALIDATION_FAILED') {
    return {
      priority: 6,
      title: 'Desktop Location Required',
      message: data.message || 'Your desktop location is outside the allowed office area, or GPS is unavailable.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'location'
    };
  }

  if (data.errorCode === 'ELECTRON_VALIDATION_FAILED') {
    return {
      priority: 6,
      title: 'Desktop Validation Failed',
      message: data.message || 'Your check-in did not meet the required validation policies for Desktop devices.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'error'
    };
  }

  // Legacy/General Electron Desktop Device Errors
  if (data.errorCode === 'CHECKOUT_DEVICE_MISMATCH') {
    return {
      priority: 4,
      title: data.title || 'Check-Out Not Allowed',
      message: data.message || 'For attendance security, you must complete Check-Out using the same approved device that was used for Check-In.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'INVALID_SIGNATURE') {
    return {
      priority: 3,
      title: data.title || 'Desktop Device Verification Failed',
      message: data.message || 'We could not verify this desktop device. Please use the official Attendance Desktop App.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'DEVICE_APPROVAL_REQUIRED') {
    return {
      priority: 4,
      title: data.title || 'Device Approval Required',
      message: data.message || 'This desktop device is not approved yet. Please wait for administrator approval before signing in.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'DEVICE_APPROVAL_PENDING') {
    return {
      priority: 4,
      title: data.title || 'Approval Pending',
      message: data.message || 'Your desktop device approval request is still pending. Please contact your administrator.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'DEVICE_REJECTED') {
    return {
      priority: 4,
      title: data.title || 'Device Rejected',
      message: data.message || 'This desktop device was rejected by your administrator. Please contact your administrator.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'DEVICE_BLOCKED') {
    return {
      priority: 3,
      title: data.title || 'Device Blocked',
      message: data.message || 'This desktop device has been blocked by your administrator. Please contact your administrator.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'CHECKOUT_DEVICE_MISMATCH' || (status === 403 && data.deviceMismatch)) {
    return {
      priority: 5,
      title: data.title || 'Check-Out Not Allowed',
      message: data.message || 'For attendance security, you must complete Check-Out using the same approved device that was used for Check-In.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'device'
    };
  }

  if (data.errorCode === 'SETTINGS_NOT_FOUND' || (status === 404 && message.includes('settings'))) {
    return {
      priority: 6,
      title: data.title || 'Settings Not Loaded',
      message: data.message || 'Office settings are not configured. Please contact administrator.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'settings'
    };
  }

  // 3 & 4. Trusted Device Status (Browser Fallback)
  if (data.deviceStatus) {
    if (data.deviceStatus === 'Pending') {
      return {
        priority: 4,
        title: 'Device Approval Required',
        message: 'This device has not yet been approved by your administrator.\n\nPlease wait for approval before signing in.',
        buttons: [ERROR_ACTIONS.OK],
        icon: 'device'
      };
    }
    if (data.deviceStatus === 'Blocked') {
      return {
        priority: 3,
        title: 'Device Blocked',
        message: 'This device has been blocked by your administrator.\n\nPlease use another approved device or contact your administrator.',
        buttons: [ERROR_ACTIONS.OK],
        icon: 'device'
      };
    }
    if (data.deviceStatus === 'Rejected' || data.isNewDevice) {
      return {
        priority: 4,
        title: 'Device Not Approved',
        message: 'Your device request has been rejected or device is not recognized.\n\nPlease contact your administrator.',
        buttons: [ERROR_ACTIONS.OK],
        icon: 'device'
      };
    }
  }

  // Check-Out Already Completed
  if (status === 400 && message.includes('already checked out')) {
    return {
      priority: 9,
      title: 'Already Checked Out',
      message: "Today's attendance has already been completed.",
      buttons: [ERROR_ACTIONS.OK],
      icon: 'check'
    };
  }

  // Check-In Already Completed
  if (status === 400 && message.includes('already checked in')) {
    return {
      priority: 9,
      title: 'Already Checked In',
      message: 'You have already checked in today.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'check'
    };
  }

  // Location Validation Failed
  if (status === 403 && (data.distance !== undefined || message.includes('radius') || message.includes('distance') || message.includes('location'))) {
    return {
      priority: 6,
      title: 'Location Verification Failed',
      message: 'You are currently outside the permitted attendance area.\n\nPlease move closer to the approved office location and try again.',
      buttons: [ERROR_ACTIONS.RETRY, ERROR_ACTIONS.CANCEL],
      icon: 'location'
    };
  }

  // IP Validation Failed
  if (status === 403 && (message.includes('ip') || message.includes('network'))) {
    return {
      priority: 6,
      title: 'Network Verification Failed',
      message: 'You are not connected to an approved office network.\n\nPlease connect to the authorized network and try again.',
      buttons: [ERROR_ACTIONS.RETRY, ERROR_ACTIONS.CANCEL],
      icon: 'network'
    };
  }

  // Database Error
  if (status === 500) {
    return {
      priority: 9,
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred while processing your request.\n\nPlease try again later.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'error'
    };
  }

  // Holiday / Sunday Check-in Block
  if (status === 403 && data.isHoliday) {
    return {
      priority: 9,
      title: data.holidayType === 'Sunday' ? 'Weekend Attendance' : 'Holiday Attendance',
      message: data.message || 'Attendance is not required today.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'check'
    };
  }

  // Early Check-In
  if (data.errorCode === 'EARLY_CHECKIN' || (status === 403 && message.includes('before office start time'))) {
    return {
      priority: 9,
      title: 'Early Check-In',
      message: data.message || 'Check-in is not allowed before office start time.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'time'
    };
  }

  // Early Check-Out
  if (data.errorCode === 'EARLY_CHECKOUT' || (status === 403 && message.includes('after office end time'))) {
    return {
      priority: 9,
      title: 'Early Check-Out',
      message: data.message || 'Check-out is not allowed before office end time.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'time'
    };
  }

  // Invalid Time (Manual Attendance)
  if (data.errorCode === 'INVALID_TIME') {
    return {
      priority: 9,
      title: 'Invalid Time',
      message: data.message || 'Check-in time cannot be after check-out time.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'time'
    };
  }

  // Duplicate Attendance
  if (data.errorCode === 'DUPLICATE_ATTENDANCE') {
    return {
      priority: 9,
      title: 'Duplicate Record',
      message: data.message || 'Attendance record already exists.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'check'
    };
  }
  
  if (status === 403 && message.includes('disabled by administrator')) {
    return {
      priority: 9,
      title: 'Check-in Disabled',
      message: data.message || 'Check-in is currently disabled.',
      buttons: [ERROR_ACTIONS.OK],
      icon: 'error'
    };
  }

  // 9. Unknown Error
  return {
    priority: 9,
    title: 'Unexpected Error',
    message: 'Something unexpected happened.\n\nPlease try again.',
    buttons: [ERROR_ACTIONS.RETRY, ERROR_ACTIONS.CANCEL],
    icon: 'error'
  };
};
