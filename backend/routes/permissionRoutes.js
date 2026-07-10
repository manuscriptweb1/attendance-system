const express = require('express');
const router = express.Router();
const { 
  getPermissions, 
  getPermissionSummary, 
  createPermission, 
  updatePermission, 
  deletePermission,
  clearPermissionRange
} = require('../controllers/permissionController');
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');

router.get('/summary', verifyToken, isAdmin, requirePermission('permissions', 'can_view'), getPermissionSummary);
router.get('/', verifyToken, isAdmin, requirePermission('permissions', 'can_view'), getPermissions);
router.post('/', verifyToken, isAdmin, requirePermission('permissions', 'can_create'), createPermission);
router.delete('/clear-range', verifyToken, isAdmin, requirePermission('permissions', 'can_clear'), clearPermissionRange);
router.put('/:id', verifyToken, isAdmin, requirePermission('permissions', 'can_edit'), updatePermission);
router.delete('/:id', verifyToken, isAdmin, requirePermission('permissions', 'can_delete'), deletePermission);

module.exports = router;
