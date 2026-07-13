/**
 * Validates a date string for the frontend before hitting the API
 * @param {string} date - Date string
 * @param {object} options - Validation options { allowFuture: false, isAbsentReason: false }
 * @returns {string|null} Error message if invalid, null if valid
 */
export const validateDateString = (date, options = {}) => {
  const { allowFuture = true, isAbsentReason = false } = options;

  if (!date || date.trim() === '') {
    return 'Date is required. Please select a date.';
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return 'Invalid date. Please select a valid date.';
  }

  if (!allowFuture) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(parsedDate);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate > today) {
      if (isAbsentReason) {
        return 'You cannot add absent reason for a future date.';
      }
      return 'You cannot select a future date.';
    }
  }

  return null; // Valid
};

/**
 * Validates a month and year for reports/payroll
 * @param {number|string} month - 1-12
 * @param {number|string} year - 4 digit year
 * @returns {string|null} Error message if invalid, null if valid
 */
export const validateMonthYear = (month, year) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  if (isNaN(m) || m < 1 || m > 12) {
    return 'Invalid month. Please select a valid month.';
  }

  const currentYear = new Date().getFullYear();
  if (isNaN(y) || y < 2000 || y > currentYear + 1) {
    return 'Invalid year. Please select a valid year.';
  }

  return null;
};
