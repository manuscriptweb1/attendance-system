const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const {
  getAllAdmins,
  addAdmin,
  updateAdmin,
  deleteAdmin,
  changePassword,
  getLoginLogs,
  getSystemHealth,
  getAdminTheme,
  updateAdminTheme
} = require('../controllers/adminController');

// All routes require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// Admin management routes
router.get('/', getAllAdmins);
router.post('/', addAdmin);
router.put('/:id', updateAdmin);
router.delete('/:id', deleteAdmin);

// Password management
router.post('/change-password', changePassword);

// Login logs
router.get('/login-logs', getLoginLogs);

// System health
router.get('/health', getSystemHealth);

// Theme preference
router.get('/theme', getAdminTheme);
router.patch('/theme', updateAdminTheme);

module.exports = router;
