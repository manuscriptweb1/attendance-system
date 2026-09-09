import axios from 'axios';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    // Preserve custom Authorization header if already present (e.g. devToken)
    const existingAuth = config.headers?.Authorization || config.headers?.authorization;
    if (!existingAuth) {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const currentPath = window.location.pathname;
    const isLoginAttempt = error.config?.url?.includes('/login');

    // 1. Check if server is in Maintenance Mode (503 with maintenance indicator)
    const isMaintenance = error.response?.status === 503 && (
      error.response?.data?.maintenance === true || 
      error.response?.data?.errorCode === 'MAINTENANCE_MODE' ||
      (error.response?.data?.message && error.response.data.message.toLowerCase().includes('maintenance'))
    );

    if (isMaintenance) {
      window.dispatchEvent(new CustomEvent('showMaintenanceMode', { detail: { error } }));
    }

    // 2. Check if server is down (502, 503 non-maintenance, 504, or network error while online)
    const isServerUnreachable = 
      !isMaintenance && (
        (error.response && [502, 503, 504].includes(error.response.status)) ||
        (!error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.code === 'ECONNABORTED') && navigator.onLine)
      );

    if (isServerUnreachable) {
      window.dispatchEvent(new CustomEvent('showServerDown', { detail: { error } }));
    }

    // 3. Check if session has expired on authenticated requests (not during login attempts)
    const storedToken = sessionStorage.getItem('token') || localStorage.getItem('token');
    const isAuthExpired = error.response?.status === 401 && !isLoginAttempt && Boolean(storedToken);
    if (isAuthExpired) {
      window.dispatchEvent(new CustomEvent('showSessionExpired', { detail: { error } }));
    }

    // Only process error messages if the user is not on a login page
    const isValidationConflict = error.response?.status === 409 && error.response?.data?.errorCode === 'DEPARTMENT_ALREADY_EXISTS';
    const isDepartmentInactive = error.response?.status === 400 && error.response?.data?.errorCode === 'DEPARTMENT_INACTIVE';
    const isManualAttendanceConflict = error.response?.data?.errorCode && ['DUPLICATE_ATTENDANCE', 'EARLY_CHECKIN', 'EARLY_CHECKOUT', 'INVALID_TIME'].includes(error.response?.data?.errorCode);
    
    if (!currentPath.includes('/login') && !isLoginAttempt && !isValidationConflict && !isDepartmentInactive && !isManualAttendanceConflict) {
      error.userMessage = 
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Something went wrong. Please try again.";
    }
    
    return Promise.reject(error);
  }
);

// Auth APIs
export const adminLogin = (credentials) => 
  api.post('/auth/admin/login', credentials);

export const employeeLogin = (credentials) => 
  api.post('/auth/employee/login', credentials);

// Employee APIs
export const getAllEmployees = () => 
  api.get('/employees');

export const getEmployeeById = (id) => 
  api.get(`/employees/${encodeURIComponent(id)}`);

export const getEmployeeFullProfile = (id) =>
  api.get(`/employees/${encodeURIComponent(id)}/full-profile`);

export const updateEmployeeMilestones = (id, data) =>
  api.put(`/employees/${encodeURIComponent(id)}/milestones`, data);

export const getEmployeeAttendanceHistory = (id, params) =>
  api.get(`/employees/${encodeURIComponent(id)}/attendance`, { params });

export const getEmployeePermissionsAndLeaves = (id) =>
  api.get(`/employees/${encodeURIComponent(id)}/permissions-and-leaves`);

export const getEmployeePayrollHistory = (id) =>
  api.get(`/employees/${encodeURIComponent(id)}/payroll`);

export const downloadEmployeeDetailsForm = (id) =>
  api.get(`/employees/${encodeURIComponent(id)}/download-form`, { responseType: 'blob' });

export const addEmployee = (data) => 
  api.post('/employees', data);

export const updateEmployee = (id, data) => 
  api.put(`/employees/${id}`, data);

export const deleteEmployee = (id) => 
  api.delete(`/employees/${id}`);

export const getResignedEmployees = () =>
  api.get('/employees/resigned');

export const updateResignedEmployee = (id, data) =>
  api.put(`/employees/resigned/${id}`, data);

export const deleteResignedEmployee = (id) =>
  api.delete(`/employees/resigned/${id}`);

export const restoreResignedEmployee = (id) =>
  api.post(`/employees/resigned/${id}/restore`);

export const getAllDepartments = () => 

  api.get('/departments');

export const addDepartment = (data) => 
  api.post('/departments', data);

export const updateDepartment = (id, data) => 
  api.put(`/departments/${id}`, data);

export const deleteDepartment = (id) => 
  api.delete(`/departments/${id}`);

// Attendance APIs
export const checkIn = (data) => 
  api.post('/attendance/checkin', data);

export const checkOut = (data) => 
  api.post('/attendance/checkout', data);

export const getTodayAttendance = () => 
  api.get('/attendance/today');

export const getEmployeeMonthlyAttendance = (month, year) => 
  api.get('/attendance/monthly', { params: { month, year } });

export const getAllAttendance = (params) => 
  api.get('/attendance/all', { params });

export const getDashboardStats = () => 
  api.get('/dashboard/stats');

// WFH APIs
export const enableWFH = (employee_id) => 
  api.post('/wfh/enable', { employee_id });

export const disableWFH = (employee_id) => 
  api.post('/wfh/disable', { employee_id });

export const getWFHStatus = () => 
  api.get('/wfh/status');

// Early Checkout APIs
export const toggleEarlyCheckout = (employeeId, enabled) => 
  api.post('/attendance/early-checkout', { employeeId, enabled });

// PDF API
export const downloadMonthlyPDF = (month, year) => {
  return api.get('/pdf/monthly', {
    params: { month, year },
    responseType: 'blob'
  });
};

// NEW: Monthly Attendance Matrix Downloads
export const downloadMonthlyMatrixPDF = (month, year) => {
  return api.get('/pdf/monthly-matrix-pdf', {
    params: { month, year },
    responseType: 'blob'
  });
};

export const downloadMonthlyMatrixExcel = (month, year) => {
  return api.get('/pdf/monthly-matrix-excel', {
    params: { month, year },
    responseType: 'blob'
  });
};

// Holiday APIs
export const getAllHolidays = (year, month) => 
  api.get('/holidays', { params: { year, month } });

export const addHoliday = (data) => 
  api.post('/holidays', data);

export const updateHoliday = (id, data) => 
  api.put(`/holidays/${id}`, data);

export const deleteHoliday = (id) => api.delete(`/holidays/${id}`);
export const clearHolidayRange = (data) => api.delete('/holidays/clear-range', { data });

export const toggleHolidayStatus = (id, is_enabled) => 
  api.patch(`/holidays/${id}/toggle`, { is_enabled });

export const checkHolidayStatus = (date) => 
  api.get('/holidays/check', { params: { date } });

// Settings APIs
export const getSettings = () => 
  api.get('/settings');

export const updateSettings = (data) => api.put('/settings', data);

// System Health
export const getSystemHealth = () => api.get('/admins/health').catch(err => ({ data: { success: false, message: err.message } }));

// Attendance Reset and Delete APIs
export const resetAttendance = (attendanceId, resetType) => 
  api.post('/attendance/reset', { attendanceId, resetType });

export const deleteAttendance = (id) => 
  api.delete(`/attendance/${id}`);

export const clearAttendanceRange = (data) =>
  api.delete('/attendance/clear-range', { data });

// Password Management APIs
export const requestPasswordChange = (currentPassword) => 
  api.post('/auth/change-password/request', { currentPassword });

export const completePasswordChange = (otp, newPassword, confirmNewPassword) => 
  api.post('/auth/change-password/complete', { otp, newPassword, confirmNewPassword });

export const requestPasswordReset = (email) => 
  api.post('/auth/forgot-password', { email });

export const verifyResetOTP = (email, otp) => 
  api.post('/auth/verify-otp', { email, otp });

export const resetPassword = (email, otp, newPassword, confirmNewPassword) => 
  api.post('/auth/reset-password', { email, otp, newPassword, confirmNewPassword });

export const resendOTP = (email, purpose) => 
  api.post('/auth/resend-otp', { email, purpose });

// OTP Settings APIs (Admin only)
export const getOTPSettings = () => 
  api.get('/settings/otp');

export const updateOTPSettings = (data) => 
  api.put('/settings/otp', data);

// Security APIs (Admin only)
export const getAuditLogs = (params) => 
  api.get('/security/audit-logs', { params });

export const clearSecurityLogRange = (data) =>
  api.delete('/security/clear-range', { data });

export const getDeviceFingerprints = (params) => 
  api.get('/security/device-fingerprints', { params });

export const getRateLimits = (params) => 
  api.get('/security/rate-limits', { params });

export const getSecurityStats = () => 
  api.get('/security/stats');

export const clearRateLimit = (employeeId) => 
  api.post('/security/clear-rate-limit', { employeeId });

// Update device alias
export const updateDeviceAlias = (deviceId, device_alias) => 
  api.put(`/security/device/${deviceId}/alias`, { device_alias });

// Trusted Devices APIs
export const getAllTrustedDevices = (params) => 
  api.get('/trusted-devices', { params });

export const getTrustedDeviceStats = () => 
  api.get('/trusted-devices/stats');

export const approveTrustedDevice = (deviceId) => 
  api.post('/trusted-devices/approve', { deviceId });

export const rejectTrustedDevice = (deviceId, remarks) => 
  api.post('/trusted-devices/reject', { deviceId, remarks });

export const updateTrustedDeviceAlias = (deviceId, deviceAlias) => 
  api.put('/trusted-devices/alias', { deviceId, deviceAlias });

export const removeTrustedDeviceApproval = (deviceId) => 
  api.post('/trusted-devices/remove-approval', { deviceId });

export const deleteTrustedDevice = (deviceId) => 
  api.delete(`/trusted-devices/${deviceId}`);

export const blockTrustedDevice = (deviceId, remarks) =>
  api.post('/trusted-devices/block', { deviceId, remarks });

export const unblockTrustedDevice = (deviceId) =>
  api.post('/trusted-devices/unblock', { deviceId });

// --- Reports ---
export const downloadMonthlyExcel = (month, year) => {
  return api.get('/pdf/monthly-excel', {
    params: { month, year },
    responseType: 'blob'
  });
};

export const getMonthlyAttendanceReport = (month, year) => 
  api.get('/reports/monthly-attendance', { params: { month, year } });

export const getReportSnapshot = (month, year) => 
  api.get('/reports/snapshot', { params: { month, year } });

export const generateMonthlyAttendanceReport = (month, year) => 
  api.post('/reports/generate', { month, year });

export const exportMonthlyAttendanceReport = (month, year) => 
  api.get('/reports/monthly-attendance/export', { params: { month, year }, responseType: 'blob' });

// --- Payroll ---
export const getPayrollRecords = (month, year) => 
  api.get('/payroll', { params: { month, year } });
export const calculatePayroll = (month, year) => 
  api.post('/payroll/calculate', { month, year });
export const updatePayrollRecord = (id, data) => api.put(`/payroll/${id}`, data);
export const updatePayrollStatus = (id, status) => api.patch(`/payroll/${id}/status`, { status });
export const updateBulkPayrollStatus = (employee_ids, status, month, year) => 
  api.patch('/payroll/bulk-status', { employee_ids, status, month, year });
export const exportPayroll = (month, year) => 
  api.get('/payroll/export', { params: { month, year }, responseType: 'blob' });
export const downloadAllPayslips = (month, year, signature = false) => 
  api.get('/payroll/payslips/download-all', { params: { month, year, signature: signature === true ? 'true' : 'false' }, responseType: 'blob' });
export const downloadSinglePayslip = (employeeId, month, year, signature = false) => 
  api.get('/payroll/payslip/download-one', { params: { employee_id: employeeId, month, year, signature: signature === true ? 'true' : 'false' }, responseType: 'blob' });
export const clearPayrollRange = (data) => api.delete('/payroll/clear-range', { data });

// --- Email Service ---
export const checkEmailHealth = () => api.get('/email/health');
export const sendTestEmail = (toEmail) => api.post('/email/test', { toEmail });

// --- Payroll Email ---
export const sendPayslipEmail = (dataOrEmpId, month, year) => {
  if (typeof dataOrEmpId === 'object' && dataOrEmpId !== null) {
    return api.post('/payroll-email/send-payslip', dataOrEmpId);
  }
  return api.post('/payroll-email/send-payslip', { employee_id: dataOrEmpId, month, year });
};
export const sendSelectedPayslipEmails = (employee_ids, month, year) =>
  api.post('/payroll-email/send-selected-payslips', { employee_ids, month, year });
export const sendAllPayslipEmails = (month, year) =>
  api.post('/payroll-email/send-all-payslips', { month, year });
export const getPayrollEmailLogs = (month, year) =>
  api.get('/payroll-email/logs', { params: { month, year } });

// --- Expenses ---
export const getExpenseTypes = () => api.get('/expenses/expense-types');
export const addExpenseType = (data) => api.post('/expenses/expense-types', data);
export const updateExpenseType = (id, data) => api.put(`/expenses/expense-types/${id}`, data);
export const deleteExpenseType = (id) => api.delete(`/expenses/expense-types/${id}`);

export const getExpenses = (month, year) => api.get('/expenses', { params: { month, year } });
export const getExpenseSummary = (month, year) => api.get('/expenses/summary', { params: { month, year } });
export const addExpense = (data) => api.post('/expenses', data);
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);
export const clearExpenseRange = (data) => api.delete('/expenses/clear-range', { data });
export const exportExpenses = (month, year) => api.get('/expenses/export', { params: { month, year }, responseType: 'blob' });

// --- Permissions ---
export const getPermissions = (month, year, employee_id) => api.get('/permissions', { params: { month, year, employee_id } });
export const getPermissionSummary = (month, year) => api.get('/permissions/summary', { params: { month, year } });
export const createPermission = (data) => api.post('/permissions', data);
export const updatePermission = (id, data) => api.put(`/permissions/${id}`, data);
export const deletePermission = (id) => api.delete(`/permissions/${id}`);
export const clearPermissionRange = (data) => api.delete('/permissions/clear-range', { data });

// --- Manual Attendance ---
export const getEmployeesForManualAttendance = (params) => api.get('/manual-attendance/employees', { params });
export const createManualAttendance = (data) => api.post('/manual-attendance', data);
export const updateManualAttendance = (id, data) => api.put(`/manual-attendance/${id}`, data);
export const deleteManualAttendance = (id) => api.delete(`/manual-attendance/${id}`);
export const checkInRowManualAttendance = (data) => api.post('/manual-attendance/check-in', data);
export const checkOutRowManualAttendance = (data) => api.post('/manual-attendance/check-out', data);
export const clearManualAttendanceRange = (data) => api.delete('/manual-attendance/clear-range', { data });

// --- Absent Reason ---
export const getAbsentEmployees = (params) => api.get('/absent-reasons', { params });
export const updateAbsentReason = (id, data) => api.put(`/absent-reasons/${id}`, data);
export const clearAbsentReason = (id) => api.delete(`/absent-reasons/${id}/clear`);
export const clearAbsentReasonRange = (data) => api.put('/absent-reasons/clear-range', data);

// --- Paid Leaves ---
export const getPaidLeaveEmployees = (params) => api.get('/paid-leaves', { params });
export const markPaidLeave = (data) => api.post('/paid-leaves/mark', data);
export const clearPaidLeave = (id, data) => api.delete(`/paid-leaves/${id}`, { data });

export default api;

// Admin Activity APIs
export const getAdminActivityLogs = (params) => 
  api.get('/admin-activity/logs', { params });

export const clearAdminActivityLogRange = (data) =>
  api.delete('/admin-activity/clear-range', { data });

export const getAdminActivityStats = () => 
  api.get('/admin-activity/stats');

export const getAdminActivityById = (id) => 
  api.get(`/admin-activity/logs/${id}`);

export const exportAdminActivityLogs = (params) => 
  api.get('/admin-activity/export', { params, responseType: 'blob' });

export const getAdminActionTypes = () => 
  api.get('/admin-activity/action-types');

export const getAdminModuleNames = () => 
  api.get('/admin-activity/module-names');

// Clear Data APIs
export const clearEmployeeAuditLogs = () => 
  api.delete('/clear-data/employee-audit');

export const clearAdminActivityLogs = () => 
  api.delete('/clear-data/admin-activity');

export const clearMonthlyAttendance = (year, month) => 
  api.delete('/clear-data/monthly-attendance', { data: { year, month } });

// Database Monitor APIs
export const getDatabaseMonitor = () => api.get('/database/monitor');

// Public APIs (No Auth Required)
export const getPublicAttendanceMatrix = (month, year) => 
  api.get('/public/attendance-matrix', { params: { month, year } });

export const getPublicHolidayInfo = () => 
  api.get('/public/holiday-info');

export const clearDataByDate = (module, data) => api.post(`/clear-data/${module}`, data);

// Admin Assistant Bot API
export const executeBotCommand = (action, payload = {}) =>
  api.post('/admin-assistant/command', { action, payload });

export const getBotCapabilities = () =>
  api.get('/admin-assistant/capabilities');

// Loan Management APIs
export const getLoanSummary = () => api.get('/loans/summary');
export const getAllLoans = (params) => api.get('/loans', { params });
export const getLoanById = (id) => api.get(`/loans/${id}`);
export const getRepaymentHistory = (id) => api.get(`/loans/${id}/transactions`);
export const previewRepaymentSchedule = (data) => api.post('/loans/preview-schedule', data);
export const createLoan = (data) => api.post('/loans', data);
export const updateLoan = (id, data) => api.put(`/loans/${id}`, data);
export const cancelLoan = (id, data) => api.post(`/loans/${id}/cancel`, data);
export const deleteLoan = (id) => api.delete(`/loans/${id}`);
export const reverseTransaction = (data) => api.post('/loans/reversal', data);
export const triggerMonthEndProcessing = (data) => api.post('/loans/trigger-month-end', data);

// Developer Testing Sandbox APIs
export const verifyDeveloperPin = (pin) => api.post('/developer-testing/verify-pin', { pin });
export const checkDeveloperSession = (token) => api.get('/developer-testing/check-session', { headers: { Authorization: `Bearer ${token}` } });
export const runDeveloperSimulation = (data, token) => api.post('/developer-testing/simulate', data, { headers: { Authorization: `Bearer ${token}` } });
export const exportDeveloperSimulationReport = (data, token) => api.post('/developer-testing/export', data, { headers: { Authorization: `Bearer ${token}` } });

// PDF Template & Branding Settings APIs
export const getBrandingSettings = () => api.get('/developer-testing/branding-settings');
export const updateBrandingSettings = (data, token) => {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  return api.post('/developer-testing/branding-settings', data, config);
};
export const resetBrandingLogo = (token) => {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  return api.post('/developer-testing/branding-settings/reset-logo', {}, config);
};
export const downloadSampleBrandingPdf = (type = 'payslip', token) => {
  const config = {
    responseType: 'blob',
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {})
  };
  return api.get(`/developer-testing/branding-settings/sample-pdf?type=${type}`, config);
};

// Offer Letter APIs
export const getOfferLetters = (params) => api.get('/offer-letters', { params });
export const getOfferLetterById = (id) => api.get(`/offer-letters/${id}`);
export const createOfferLetter = (data) => api.post('/offer-letters', data);
export const updateOfferLetter = (id, data) => api.put(`/offer-letters/${id}`, data);
export const generateOfferLetter = (id) => api.post(`/offer-letters/${id}/generate`);
export const deleteOfferLetter = (id) => api.delete(`/offer-letters/${id}`);
export const downloadOfferLetterPdf = (id, includeSignature = true) =>
  api.get(`/offer-letters/${id}/download`, { params: { signature: includeSignature }, responseType: 'blob' });
export const previewOfferLetterPdf = (id, includeSignature = true) =>
  api.get(`/offer-letters/${id}/preview`, { params: { signature: includeSignature }, responseType: 'blob' });

// Dedicated Offer Letter Settings APIs
export const getOfferLetterSettings = () => api.get('/offer-letters/settings');
export const updateOfferLetterSettings = (data) => api.put('/offer-letters/settings', data);
export const resetOfferLetterLogo = () => api.post('/offer-letters/settings/reset-logo');

// Role Responsibility Templates APIs
export const getRoleTemplates = () => api.get('/offer-letters/role-templates');
export const saveRoleTemplate = (data) => api.post('/offer-letters/role-templates', data);
export const deleteRoleTemplate = (id) => api.delete(`/offer-letters/role-templates/${id}`);

// Experience Letter APIs
export const getExperienceLetters = (params) => api.get('/experience-letters', { params });
export const getExperienceLetterById = (id) => api.get(`/experience-letters/${id}`);
export const createExperienceLetter = (data) => api.post('/experience-letters', data);
export const updateExperienceLetter = (id, data) => api.put(`/experience-letters/${id}`, data);
export const generateExperienceLetter = (id) => api.post(`/experience-letters/${id}/generate`);
export const deleteExperienceLetter = (id) => api.delete(`/experience-letters/${id}`);
export const downloadExperienceLetterPdf = (id, includeSignature = true) =>
  api.get(`/experience-letters/${id}/download`, { params: { signature: includeSignature }, responseType: 'blob' });
export const previewExperienceLetterPdf = (id, includeSignature = true) =>
  api.get(`/experience-letters/${id}/preview`, { params: { signature: includeSignature }, responseType: 'blob' });

// Relieving Letter APIs
export const getRelievingLetters = (params) => api.get('/relieving-letters', { params });
export const getRelievingLetterById = (id) => api.get(`/relieving-letters/${id}`);
export const createRelievingLetter = (data) => api.post('/relieving-letters', data);
export const updateRelievingLetter = (id, data) => api.put(`/relieving-letters/${id}`, data);
export const generateRelievingLetter = (id) => api.post(`/relieving-letters/${id}/generate`);
export const deleteRelievingLetter = (id) => api.delete(`/relieving-letters/${id}`);
export const downloadRelievingLetterPdf = (id, includeSignature = true) =>
  api.get(`/relieving-letters/${id}/download`, { params: { signature: includeSignature }, responseType: 'blob' });
export const previewRelievingLetterPdf = (id, includeSignature = true) =>
  api.get(`/relieving-letters/${id}/preview`, { params: { signature: includeSignature }, responseType: 'blob' });

