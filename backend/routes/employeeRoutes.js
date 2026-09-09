const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getAllEmployees,
  getEmployeeById,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getResignedEmployees,
  updateResignedEmployee,
  deleteResignedEmployeePermanently,
  restoreResignedEmployee,
  getAllDepartments,
  downloadEmployeeDetailsForm,
  getEmployeeFullProfile,
  updateEmployeeMilestones,
  getEmployeeAttendanceHistory,
  getEmployeePermissionsAndLeaves,
  getEmployeePayrollHistory
} = require('../controllers/employeeController');

// All routes require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// Get all employees
router.get('/', requirePermission('employees', 'can_view'), getAllEmployees);

// Get all departments (needed for Add/Edit dropdowns, so can_view is sufficient)
router.get('/departments', requirePermission('employees', 'can_view'), getAllDepartments);

// Resigned Employees Routes (place before /:id)
router.get('/resigned', requirePermission('employees', 'can_view'), getResignedEmployees);
router.put('/resigned/:id', requirePermission('employees', 'can_edit'), updateResignedEmployee);
router.delete('/resigned/:id', requirePermission('employees', 'can_delete'), deleteResignedEmployeePermanently);
router.post('/resigned/:id/restore', requirePermission('employees', 'can_create'), restoreResignedEmployee);

// Download employee details form PDF
router.get('/:id/download-form', requirePermission('employees', 'can_view'), downloadEmployeeDetailsForm);

// Employee Full 360 Profile, Attendance, Permissions/Leaves & Payroll
router.get('/:id/full-profile', requirePermission('employees', 'can_view'), getEmployeeFullProfile);
router.put('/:id/milestones', requirePermission('employees', 'can_edit'), updateEmployeeMilestones);
router.get('/:id/attendance', requirePermission('employees', 'can_view'), getEmployeeAttendanceHistory);
router.get('/:id/permissions-and-leaves', requirePermission('employees', 'can_view'), getEmployeePermissionsAndLeaves);
router.get('/:id/payroll', requirePermission('employees', 'can_view'), getEmployeePayrollHistory);

// Get single employee
router.get('/:id', requirePermission('employees', 'can_view'), getEmployeeById);

// Add employee
router.post('/', requirePermission('employees', 'can_create'), addEmployee);

// Update employee
router.put('/:id', requirePermission('employees', 'can_edit'), updateEmployee);

// Delete employee
router.delete('/:id', requirePermission('employees', 'can_delete'), deleteEmployee);

module.exports = router;

