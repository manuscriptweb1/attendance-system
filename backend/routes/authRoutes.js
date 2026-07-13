const express = require('express');
const router = express.Router();
const { adminLogin, employeeLogin } = require('../controllers/authController');
const {
  requestPasswordChange,
  completePasswordChange,
  requestPasswordReset,
  verifyResetOTP,
  resetPassword,
  resendOTP
} = require('../controllers/passwordController');
const { verifyToken } = require('../middleware/auth');

// Admin login
router.post('/admin/login', adminLogin);

// Employee login
router.post('/employee/login', employeeLogin);

// Password Change (Logged-in users)
router.post('/change-password/request', verifyToken, requestPasswordChange);
router.post('/change-password/complete', verifyToken, completePasswordChange);

// Forgot Password (Not logged in)
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// Resend OTP
router.post('/resend-otp', resendOTP);

module.exports = router;
