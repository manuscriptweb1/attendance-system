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
const { verifyToken, isAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(verifyToken);
router.use(isAdmin);

// Get activity logs with filters
router.get('/logs', getActivityLogs);

// Clear activity logs for date range
router.delete('/clear-range', clearActivityLogRange);

// Get activity statistics
router.get('/stats', getStats);

// Get single activity log
router.get('/logs/:id', getActivityById);

// Export activity logs
router.get('/export', exportActivityLogs);

// Get unique action types
router.get('/action-types', getActionTypes);

// Get unique module names
router.get('/module-names', getModuleNames);

module.exports = router;
