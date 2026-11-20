const TIMEZONE = 'Asia/Kolkata';

/**
 * Helper to safely parse any date/time input (Date, ISO string, SQL timestamp string)
 * into a Date object representing the correct instant in Asia/Kolkata.
 */
const parseToDate = (input) => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // If it's a date-time string without timezone, like "2026-11-17 18:00:00" or "2026-11-17T18:00:00"
    // Postgres and the application store IST timestamps literally; appending '+05:30' ensures correct parsing
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const isoStr = trimmed.replace(' ', 'T');
      const withSeconds = isoStr.length === 16 ? `${isoStr}:00` : isoStr;
      return new Date(`${withSeconds}+05:30`);
    }
    return new Date(trimmed);
  }

  return new Date(input);
};

const istFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const getISTMinuteData = (dateInput) => {
  const d = parseToDate(dateInput);
  if (!d || isNaN(d.getTime())) return null;

  const parts = istFormatter.formatToParts(d);
  const p = {};
  parts.forEach(({ type, value }) => { p[type] = value; });

  const hour = parseInt(p.hour, 10);
  const minute = parseInt(p.minute, 10);

  return {
    dateStr: `${p.year}-${p.month}-${p.day}`,
    minuteOfDay: hour * 60 + minute,
    epochMinute: Math.floor(d.getTime() / 60000)
  };
};

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
 * Helper to parse time string like "09:45", "09:45:00", "09:45 AM", "09:45 PM" into minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  
  // Match HH:mm or HH:mm:ss with optional AM/PM
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i);
  if (!match) return 0;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
};

// Backwards compatibility alias
const parseOfficeTimeToMinutes = timeToMinutes;
const parseTime = timeToMinutes;

/**
 * Returns minutes from midnight safely in Asia/Kolkata
 */
const getLocalTimeMinutes = (dateOrTimeStr) => {
  if (!dateOrTimeStr) return 0;
  
  // If it's already a time string like "09:30"
  if (typeof dateOrTimeStr === 'string' && dateOrTimeStr.length <= 8 && dateOrTimeStr.includes(':')) {
    return parseOfficeTimeToMinutes(dateOrTimeStr);
  }

  // It's a full ISO or date string. Parse it safely in IST.
  const d = parseToDate(dateOrTimeStr);
  if (!d || isNaN(d.getTime())) return 0;
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
  
  const halfDayThreshold = parseFloat(wh.halfDayThreshold || wh.half_day_threshold || wh.minimum_half_day_hours || wh.half_day_hours || 4);

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

  const loginIST = getISTMinuteData(loginTimeStr);
  const logoutIST = getISTMinuteData(logoutTimeStr);
  if (!loginIST || !logoutIST) return 0;

  // If officeStartTimeMins is provided and employee checked in early, effective start is office start time
  let effectiveLoginMinute = loginIST.minuteOfDay;
  if (officeStartTimeMins !== null && effectiveLoginMinute < officeStartTimeMins) {
    effectiveLoginMinute = officeStartTimeMins;
  }

  // Same calendar day in IST
  if (loginIST.dateStr === logoutIST.dateStr) {
    const worked = logoutIST.minuteOfDay - effectiveLoginMinute;
    return worked > 0 ? worked : 0;
  }

  // Cross-date calculation using epoch minutes
  let adjustedLoginEpoch = loginIST.epochMinute;
  if (officeStartTimeMins !== null && loginIST.minuteOfDay < officeStartTimeMins) {
    adjustedLoginEpoch += (officeStartTimeMins - loginIST.minuteOfDay);
  }
  const worked = logoutIST.epochMinute - adjustedLoginEpoch;
  return worked > 0 ? worked : 0;
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
  timeToMinutes,
  getLocalTimeMinutes,
  getOfficeTimes,
  calculateCheckInStatus,
  calculateCheckOutStatus,
  calculateWorkedMinutes,
  formatTime12Hour,
  getLocalMinutesFromUTC
};
