const express = require('express');
const router = express.Router();
const {
  clearEmployeeAuditLogs,
  clearAdminActivityLogs,
  clearMonthlyAttendance
} = require('../controllers/clearDataController');
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');

// All routes require admin authentication
router.use(verifyToken);
router.use(isAdmin);

// Clear employee audit logs
router.delete('/employee-audit', requirePermission('security_logs', 'can_clear'), clearEmployeeAuditLogs);

// Clear admin activity logs
router.delete('/admin-activity', requirePermission('activity_logs', 'can_clear'), clearAdminActivityLogs);

// Clear monthly attendance
router.delete('/monthly-attendance', requirePermission('attendance', 'can_clear'), clearMonthlyAttendance);

const { clearDataByDate } = require('../controllers/clearDataController');

const clearableModules = [
  'attendance', 'manual_attendance', 'holidays', 'payroll', 'expenses', 'reports', 
  'activity_logs', 'security_logs', 'employees', 'departments', 'assign_work', 
  'workflow_templates', 'work_pipeline', 'work_monitoring', 'hold_works', 'completed_works',
  'admin_management'
];

clearableModules.forEach(module => {
  router.post(`/${module}`, requirePermission(module, 'can_clear'), (req, res) => {
    req.body.module = module;
    clearDataByDate(req, res);
  });
});

module.exports = router;
