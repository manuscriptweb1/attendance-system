const express = require('express');
const router = express.Router();
const {
  getActivityLogs,
  getStats,
  getActivityById,
  exportActivityLogs,
  getActionTypes,
  getModuleNames,
  clearActivityLogRange
} = require('../controllers/adminActivityController');
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');

// All routes require admin authentication
router.use(verifyToken);
router.use(isAdmin);

// Get activity logs with filters
router.get('/logs', requirePermission('activity_logs', 'can_view'), getActivityLogs);

// Clear activity logs for date range
router.delete('/clear-range', requirePermission('activity_logs', 'can_clear'), clearActivityLogRange);

// Get activity statistics
router.get('/stats', requirePermission('activity_logs', 'can_view'), getStats);

// Get single activity log
router.get('/logs/:id', requirePermission('activity_logs', 'can_view'), getActivityById);

// Export activity logs
router.get('/export', requirePermission('activity_logs', 'can_export'), exportActivityLogs);

// Get unique action types
router.get('/action-types', requirePermission('activity_logs', 'can_view'), getActionTypes);

// Get unique module names
router.get('/module-names', requirePermission('activity_logs', 'can_view'), getModuleNames);

module.exports = router;
