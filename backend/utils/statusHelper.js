/**
 * Normalizes variations of attendance status strings into the standard database states.
 * 
 * @param {string} status - The raw status string from the frontend or API payload.
 * @returns {string} The normalized status string ('Present', 'Late', 'Half Day', 'Absent', 'Not Mention').
 */
function normalizeAttendanceStatus(status) {
  const s = String(status || '').trim().toLowerCase();

  if (s === 'p' || s === 'present') return 'Present';
  if (s === 'late') return 'Late';
  if (s === 'hd' || s === 'half day' || s === 'half_day') return 'Half Day';
  if (s === 'a' || s === 'absent') return 'Absent';
  if (s === 'not mention' || s === 'not mentioned' || s === 'not_mention' || s === 'not_mentioned') return 'Not Mention';

  return 'Not Mention';
}

module.exports = {
  normalizeAttendanceStatus
};
