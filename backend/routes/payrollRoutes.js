const express = require('express');
const router = express.Router();
const { getPayrollRecords, calculatePayroll, updatePayrollStatus, exportPayroll, updatePayrollRecord, calculateSinglePayroll, getPaySlipData, clearPayrollRange, downloadAllPayslipsPDF, downloadSinglePayslipPDF } = require('../controllers/payrollController');
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, requirePermission('payroll', 'can_view'), getPayrollRecords);
router.get('/payslip', verifyToken, isAdmin, requirePermission('payroll', 'can_view'), getPaySlipData);
router.get('/payslip/download-one', verifyToken, isAdmin, requirePermission('payroll', 'can_export'), downloadSinglePayslipPDF);
router.get('/payslips/download-all', verifyToken, isAdmin, requirePermission('payroll', 'can_export'), downloadAllPayslipsPDF);
router.post('/calculate', verifyToken, isAdmin, requirePermission('payroll', 'can_calculate'), calculatePayroll);
router.post('/calculate/:employeeId', verifyToken, isAdmin, requirePermission('payroll', 'can_calculate'), calculateSinglePayroll);
router.patch('/:id/status', verifyToken, isAdmin, requirePermission('payroll', 'can_edit'), updatePayrollStatus);
router.delete('/clear-range', verifyToken, isAdmin, requirePermission('payroll', 'can_clear'), clearPayrollRange);
router.put('/:id', verifyToken, isAdmin, requirePermission('payroll', 'can_edit'), updatePayrollRecord);
router.get('/export', verifyToken, isAdmin, requirePermission('payroll', 'can_export'), exportPayroll);

module.exports = router;
