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

module.exports = router;
