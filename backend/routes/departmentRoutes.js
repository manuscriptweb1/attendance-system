const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getAllDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment
} = require('../controllers/departmentController');

// All department routes require authentication
router.use(verifyToken);

// Get all departments (accessible by both admins and employees for dropdowns)
router.get('/', getAllDepartments);

// Admin-only routes for managing departments
router.post('/', isAdmin, requirePermission('departments', 'can_create'), addDepartment);
router.put('/:id', isAdmin, requirePermission('departments', 'can_edit'), updateDepartment);
router.delete('/:id', isAdmin, requirePermission('departments', 'can_delete'), deleteDepartment);

module.exports = router;
