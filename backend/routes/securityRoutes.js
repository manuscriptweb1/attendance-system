const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getAuditLogs,
  getDeviceFingerprints,
  getRateLimits,
  getSecurityStats,
  clearRateLimit,
  updateDeviceAlias,
  clearSecurityLogRange
} = require('../controllers/securityController');

// All routes require admin authentication
router.use(verifyToken, isAdmin);

// Get audit logs
router.get('/audit-logs', requirePermission('security_logs', 'can_view'), getAuditLogs);
router.delete('/clear-range', requirePermission('security_logs', 'can_clear'), clearSecurityLogRange);

// Get device fingerprints
router.get('/device-fingerprints', requirePermission('security_logs', 'can_view'), getDeviceFingerprints);

// Get rate limits
router.get('/rate-limits', requirePermission('security_logs', 'can_view'), getRateLimits);

// Get security statistics
router.get('/stats', requirePermission('security_logs', 'can_view'), getSecurityStats);

// Clear rate limit for an employee
router.post('/clear-rate-limit', requirePermission('security_logs', 'can_clear'), clearRateLimit);

// Update device alias
router.put('/device/:id/alias', requirePermission('security_logs', 'can_edit'), updateDeviceAlias);

module.exports = router;
