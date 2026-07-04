const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
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
router.get('/audit-logs', getAuditLogs);
router.delete('/clear-range', clearSecurityLogRange);

// Get device fingerprints
router.get('/device-fingerprints', getDeviceFingerprints);

// Get rate limits
router.get('/rate-limits', getRateLimits);

// Get security statistics
router.get('/stats', getSecurityStats);

// Clear rate limit for an employee
router.post('/clear-rate-limit', clearRateLimit);

// Update device alias
router.put('/device/:id/alias', updateDeviceAlias);

module.exports = router;
