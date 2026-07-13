class AppError extends Error {
  constructor(message, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

/**
 * Validates a date input for backend controllers
 * @param {string} dateValue - The date string to validate
 * @param {object} options - Validation options (e.g., { allowFuture: false, isAbsentReason: false })
 * @returns {Date} Parsed date object if valid
 * @throws {AppError} If validation fails
 */
const validateDateInput = (dateValue, options = {}) => {
  const { allowFuture = true, isAbsentReason = false } = options;

  if (!dateValue || (typeof dateValue === 'string' && dateValue.trim() === '')) {
    throw new AppError("Date is required. Please select a date.", 400, "DATE_REQUIRED");
  }

  const parsedDate = new Date(dateValue);
  
  if (isNaN(parsedDate.getTime())) {
    throw new AppError("Invalid date. Please select a valid date.", 400, "INVALID_DATE");
  }

  if (!allowFuture) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(parsedDate);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate > today) {
      if (isAbsentReason) {
        throw new AppError("You cannot add absent reason for a future date.", 400, "FUTURE_DATE_NOT_ALLOWED");
      }
      throw new AppError("You cannot select a future date.", 400, "FUTURE_DATE_NOT_ALLOWED");
    }
  }

  return parsedDate;
};

module.exports = {
  AppError,
  validateDateInput
};
