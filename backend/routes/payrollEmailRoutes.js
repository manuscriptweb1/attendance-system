const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  sendPayslipEmail,
  sendSelectedPayslips,
  sendAllPayslips,
  getLogs
} = require('../controllers/payrollEmailController');

// All email routes require Admin auth & permission checks
router.post('/send-payslip', verifyToken, isAdmin, requirePermission('payroll', 'can_export'), sendPayslipEmail);
router.post('/send-selected-payslips', verifyToken, isAdmin, requirePermission('payroll', 'can_export'), sendSelectedPayslips);
router.post('/send-all-payslips', verifyToken, isAdmin, requirePermission('payroll', 'can_export'), sendAllPayslips);
router.get('/logs', verifyToken, isAdmin, requirePermission('payroll', 'can_view'), getLogs);

module.exports = router;
