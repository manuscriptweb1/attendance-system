const express = require('express');
const router = express.Router();
const { 
  getPermissions, 
  getPermissionSummary, 
  getEmployeePermissionQuota, 
  createPermission, 
  updatePermission, 
  updatePermissionLimit, 
  deletePermission,
  clearPermissionRange
} = require('../controllers/permissionController');
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');

router.get('/summary', verifyToken, isAdmin, requirePermission('permissions', 'can_view'), getPermissionSummary);
router.get('/quota/:employeeId', verifyToken, isAdmin, requirePermission('permissions', 'can_view'), getEmployeePermissionQuota);
router.put('/limit', verifyToken, isAdmin, requirePermission('permissions', 'can_edit'), updatePermissionLimit);
router.get('/', verifyToken, isAdmin, requirePermission('permissions', 'can_view'), getPermissions);
router.post('/', verifyToken, isAdmin, requirePermission('permissions', 'can_create'), createPermission);
router.delete('/clear-range', verifyToken, isAdmin, requirePermission('permissions', 'can_clear'), clearPermissionRange);
router.put('/:id', verifyToken, isAdmin, requirePermission('permissions', 'can_edit'), updatePermission);
router.delete('/:id', verifyToken, isAdmin, requirePermission('permissions', 'can_delete'), deletePermission);

module.exports = router;
