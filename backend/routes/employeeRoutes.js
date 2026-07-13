const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getAllEmployees,
  getEmployeeById,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getAllDepartments
} = require('../controllers/employeeController');

// All routes require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// Get all employees
router.get('/', requirePermission('employees', 'can_view'), getAllEmployees);

// Get all departments (needed for Add/Edit dropdowns, so can_view is sufficient)
router.get('/departments', requirePermission('employees', 'can_view'), getAllDepartments);

// Get single employee
router.get('/:id', requirePermission('employees', 'can_view'), getEmployeeById);

// Add employee
router.post('/', requirePermission('employees', 'can_create'), addEmployee);

// Update employee
router.put('/:id', requirePermission('employees', 'can_edit'), updateEmployee);

// Delete employee
router.delete('/:id', requirePermission('employees', 'can_delete'), deleteEmployee);

module.exports = router;
