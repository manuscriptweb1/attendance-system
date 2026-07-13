const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getAllAdmins,
  addAdmin,
  updateAdmin,
  deleteAdmin,
  changePassword,
  getLoginLogs,
  getSystemHealth,
  getAdminTheme,
  updateAdminTheme,
  getAdminPages,
  getAdminPermissions
} = require('../controllers/adminController');

// All routes require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// Admin management routes
router.get('/permissions/pages', requirePermission('admin_management', 'can_view'), getAdminPages);
router.get('/permissions/:adminId', requirePermission('admin_management', 'can_view'), getAdminPermissions);
router.get('/', requirePermission('admin_management', 'can_view'), getAllAdmins);
router.post('/', requirePermission('admin_management', 'can_create'), addAdmin);
router.put('/:id', requirePermission('admin_management', 'can_edit'), updateAdmin);
router.delete('/:id', requirePermission('admin_management', 'can_delete'), deleteAdmin);

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
