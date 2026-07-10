const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current India date-time safely for database insertion
 * Formatted as "YYYY-MM-DDTHH:mm:ss" so Postgres stores it literally
 */
const getIndiaDateTime = () => {
  // Use Intl.DateTimeFormat to avoid adding moment if not installed, but since it's backend let's use native robustly
  const now = new Date();
  const options = { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(now);
  
  const p = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  
  // en-GB format is DD/MM/YYYY, HH:mm:ss
  // We want YYYY-MM-DDTHH:mm:ss
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
};

/**
 * Helper to parse time string like "08:00 PM" or "20:00" into minutes from midnight
 */
const parseOfficeTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return 0;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
};

// Backwards compatibility alias
const parseTime = parseOfficeTimeToMinutes;

/**
 * Returns minutes from midnight safely in Asia/Kolkata
 */
const getLocalTimeMinutes = (dateOrTimeStr) => {
  if (!dateOrTimeStr) return 0;
  
  // If it's already a time string like "09:30"
  if (typeof dateOrTimeStr === 'string' && dateOrTimeStr.length <= 8 && dateOrTimeStr.includes(':')) {
    return parseOfficeTimeToMinutes(dateOrTimeStr);
  }

  // It's a full ISO date string. Parse it in IST.
  const d = new Date(dateOrTimeStr);
  const options = { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false };
  const timeString = new Intl.DateTimeFormat('en-GB', options).format(d); // "HH:mm"
  return parseOfficeTimeToMinutes(timeString);
};

const getOfficeTimes = (settings) => {
  if (!settings) return { startTime: 0, lateTime: 0, endTime: 0, halfDayThreshold: 4 };
  
  const wh = settings.workingHours || settings;

  const rawStart = wh.office_start_time || wh.officeStartTime || wh.start_time;
  const rawLate = wh.office_late_time || wh.late_time || wh.lateAfterTime || wh.officeLateTime;
  const rawEnd = wh.office_end_time || wh.officeEndTime || wh.end_time;
  
  const halfDayThreshold = parseFloat(wh.minimum_half_day_hours || wh.half_day_hours || 4);

  return {
    startTime: parseOfficeTimeToMinutes(rawStart),
    lateTime: parseOfficeTimeToMinutes(rawLate),
    endTime: parseOfficeTimeToMinutes(rawEnd),
    halfDayThreshold
  };
};

const calculateCheckInStatus = (loginTimeStr, officeStartTimeMins, lateAfterTimeMins) => {
  const checkInMins = getLocalTimeMinutes(loginTimeStr);
  
  let checkin_status = 'On Time';
  let late_minutes = 0;
  let early_checkin_minutes = 0;

  if (checkInMins <= lateAfterTimeMins) {
    // If checkInMins < officeStartTimeMins, it's early but we mark as 'On Time'
    checkin_status = 'On Time';
    if (checkInMins < officeStartTimeMins) {
      early_checkin_minutes = officeStartTimeMins - checkInMins;
    }
  } else {
    checkin_status = 'Late';
    late_minutes = checkInMins - lateAfterTimeMins;
  }

  return { checkin_status, late_minutes, early_checkin_minutes };
};

const calculateCheckOutStatus = (logoutTimeStr, officeEndTimeMins) => {
  if (!logoutTimeStr) return { checkout_status: null, early_minutes: 0, late_checkout_minutes: 0 };
  
  const checkOutMins = getLocalTimeMinutes(logoutTimeStr);
  
  let checkout_status = 'On Time';
  let early_minutes = 0;
  let late_checkout_minutes = 0;

  if (checkOutMins < officeEndTimeMins) {
    checkout_status = 'Early Check-Out';
    early_minutes = officeEndTimeMins - checkOutMins;
  } else if (checkOutMins > officeEndTimeMins) {
    checkout_status = 'Late Check-Out';
    late_checkout_minutes = checkOutMins - officeEndTimeMins;
  }

  return { checkout_status, early_minutes, late_checkout_minutes };
};

const calculateWorkedMinutes = (loginTimeStr, logoutTimeStr, officeStartTimeMins = null) => {
  if (!loginTimeStr || !logoutTimeStr) return 0;
  
  let d1 = new Date(loginTimeStr);
  const d2 = new Date(logoutTimeStr);
  
  // If officeStartTimeMins is provided, calculate effective login time
  if (officeStartTimeMins !== null) {
    const loginMins = getLocalTimeMinutes(loginTimeStr);
    if (loginMins < officeStartTimeMins) {
      const earlyMs = (officeStartTimeMins - loginMins) * 60 * 1000;
      d1 = new Date(d1.getTime() + earlyMs);
    }
  }
  
  const ms = d2.getTime() - d1.getTime();
  if (ms <= 0) return 0;
  
  return Math.floor(ms / (1000 * 60));
};

const formatTime12Hour = (dateOrTimeStr) => {
  if (!dateOrTimeStr) return '-';

  try {
    // If it's a raw time string "HH:mm"
    if (typeof dateOrTimeStr === 'string' && dateOrTimeStr.length <= 8 && dateOrTimeStr.includes(':')) {
      const match = dateOrTimeStr.trim().match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        let hour = parseInt(match[1], 10);
        const minute = match[2];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
      }
    }

    const d = new Date(dateOrTimeStr);
    if (isNaN(d.getTime())) return '-';
    
    const options = { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: true };
    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch (err) {
    return '-';
  }
};

const getLocalMinutesFromUTC = (utcDateStr) => {
  if (!utcDateStr) return 0;
  return getLocalTimeMinutes(utcDateStr);
};

module.exports = {
  getIndiaDateTime,
  parseTime,
  parseOfficeTimeToMinutes,
  getLocalTimeMinutes,
  getOfficeTimes,
  calculateCheckInStatus,
  calculateCheckOutStatus,
  calculateWorkedMinutes,
  formatTime12Hour,
  getLocalMinutesFromUTC
};
