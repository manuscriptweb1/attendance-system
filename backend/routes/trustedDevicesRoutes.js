const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getAllTrustedDevices,
  getDeviceStats,
  approveDevice,
  rejectDevice,
  updateDeviceAlias,
  removeApproval,
  deleteDevice,
  blockDevice,
  unblockDevice
} = require('../controllers/trustedDevicesController');

// All routes require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// Get all trusted devices with filtering
router.get('/', requirePermission('trusted_devices', 'can_view'), getAllTrustedDevices);

// Get device statistics
router.get('/stats', requirePermission('trusted_devices', 'can_view'), getDeviceStats);

// Approve device
router.post('/approve', requirePermission('trusted_devices', 'can_approve'), approveDevice);

// Reject device
router.post('/reject', requirePermission('trusted_devices', 'can_approve'), rejectDevice);

// Update device alias
router.put('/alias', requirePermission('trusted_devices', 'can_edit'), updateDeviceAlias);

// Remove approval
router.post('/remove-approval', requirePermission('trusted_devices', 'can_approve'), removeApproval);

// Delete device
router.delete('/:id', requirePermission('trusted_devices', 'can_delete'), deleteDevice);

// Block device
router.post('/block', requirePermission('trusted_devices', 'can_approve'), blockDevice);

// Unblock device
router.post('/unblock', requirePermission('trusted_devices', 'can_approve'), unblockDevice);

module.exports = router;
