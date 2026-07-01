/**
 * Helper to parse time string like "08:00 PM" or "20:00" into minutes from midnight
 */
const parseTime = (timeStr) => {
  if (!timeStr) return 0;
  
  // if format is "HH:mm" (24h) or "HH:mm AM/PM" (12h)
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return 0;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
};

const getOfficeTimes = (settings) => {
  if (!settings) return { startTime: 0, lateTime: 0, endTime: 0 };
  
  const wh = settings.workingHours || settings;

  const rawStart = wh.office_start_time || wh.officeStartTime || wh.start_time;
  const rawLate = wh.office_late_time || wh.late_time || wh.lateAfterTime || wh.officeLateTime;
  const rawEnd = wh.office_end_time || wh.officeEndTime || wh.end_time;

  return {
    startTime: parseTime(rawStart),
    lateTime: parseTime(rawLate),
    endTime: parseTime(rawEnd)
  };
};

const getLocalMinutesFromUTC = (utcDateStr) => {
  if (!utcDateStr) return 0;
  const d = new Date(utcDateStr);
  const istMinutes = d.getUTCHours() * 60 + d.getUTCMinutes() + (5.5 * 60);
  return istMinutes % (24 * 60);
};

module.exports = {
  parseTime,
  getOfficeTimes,
  getLocalMinutesFromUTC
};
