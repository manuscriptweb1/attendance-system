const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { getOTPSettings, updateOTPSettings } = require('../controllers/otpSettingsController');

// Get settings - available to all authenticated users
router.get('/', verifyToken, getSettings);

// Update settings - admin only
router.put('/', verifyToken, isAdmin, requirePermission('settings', 'can_edit'), updateSettings);

// OTP Settings - admin only
router.get('/otp', verifyToken, isAdmin, requirePermission('otp_settings', 'can_view'), getOTPSettings);
router.put('/otp', verifyToken, isAdmin, requirePermission('otp_settings', 'can_edit'), updateOTPSettings);

module.exports = router;
