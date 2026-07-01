import axios from 'axios';
import { mapErrorToDialogConfig } from '../utils/errorMapper';

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
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only process errors if the user is not on a login page
    const currentPath = window.location.pathname;
    const isLoginAttempt = error.config?.url?.includes('/login');
    const isValidationConflict = error.response?.status === 409 && error.response?.data?.errorCode === 'DEPARTMENT_ALREADY_EXISTS';
    const isDepartmentInactive = error.response?.status === 400 && error.response?.data?.errorCode === 'DEPARTMENT_INACTIVE';
    const isManualAttendanceConflict = error.response?.data?.errorCode && ['DUPLICATE_ATTENDANCE', 'EARLY_CHECKIN', 'EARLY_CHECKOUT', 'INVALID_TIME'].includes(error.response?.data?.errorCode);
    
    if (!currentPath.includes('/login') && !isLoginAttempt && !isValidationConflict && !isDepartmentInactive && !isManualAttendanceConflict) {
      // Map error to config and dispatch
      const config = mapErrorToDialogConfig(error);
      window.dispatchEvent(new CustomEvent('showGlobalError', { detail: config }));
      
      // Attach flag so components know it was handled globally
      error.isGlobalError = true;
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
  api.get(`/employees/${id}`);

export const addEmployee = (data) => 
  api.post('/employees', data);

export const updateEmployee = (id, data) => 
  api.put(`/employees/${id}`, data);

export const deleteEmployee = (id) => 
  api.delete(`/employees/${id}`);

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

export const deleteHoliday = (id) => 
  api.delete(`/holidays/${id}`);

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

export const exportMonthlyAttendanceReport = (month, year) => 
  api.get('/reports/monthly-attendance/export', { params: { month, year }, responseType: 'blob' });

// --- Payroll ---
export const getPayrollRecords = (month, year) => 
  api.get('/payroll', { params: { month, year } });
export const calculatePayroll = (month, year) => 
  api.post('/payroll/calculate', { month, year });
export const updatePayrollStatus = (id, status) => 
  api.patch(`/payroll/${id}/status`, { status });
export const exportPayroll = (month, year) => 
  api.get('/payroll/export', { params: { month, year }, responseType: 'blob' });

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
export const exportExpenses = (month, year) => api.get('/expenses/export', { params: { month, year }, responseType: 'blob' });

// --- Manual Attendance ---
export const getEmployeesForManualAttendance = (params) => api.get('/manual-attendance/employees', { params });
export const createManualAttendance = (data) => api.post('/manual-attendance', data);
export const updateManualAttendance = (id, data) => api.put(`/manual-attendance/${id}`, data);
export const deleteManualAttendance = (id) => api.delete(`/manual-attendance/${id}`);

// --- Absent Reason ---
export const getAbsentEmployees = (params) => api.get('/absent-reasons', { params });
export const updateAbsentReason = (id, data) => api.put(`/absent-reasons/${id}`, data);
export const clearAbsentReason = (id) => api.delete(`/absent-reasons/${id}/clear`);

export default api;

// Admin Activity APIs
export const getAdminActivityLogs = (params) => 
  api.get('/admin-activity/logs', { params });

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
