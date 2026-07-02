/**
 * Extracts a user-friendly error message from an API response
 * @param {Error} error - The error object caught from axios or standard Error
 * @param {string} fallback - Fallback message if no error message is found
 * @returns {string} The precise error message to display
 */
export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  return (
    error?.userMessage || // Processed by axios interceptor
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
};
