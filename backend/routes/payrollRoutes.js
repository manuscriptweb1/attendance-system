const express = require('express');
const router = express.Router();
const { getPayrollRecords, calculatePayroll, updatePayrollStatus, exportPayroll, updatePayrollRecord, calculateSinglePayroll, getPaySlipData, clearPayrollRange } = require('../controllers/payrollController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, getPayrollRecords);
router.get('/payslip', verifyToken, isAdmin, getPaySlipData);
router.post('/calculate', verifyToken, isAdmin, calculatePayroll);
router.post('/calculate/:employeeId', verifyToken, isAdmin, calculateSinglePayroll);
router.patch('/:id/status', verifyToken, isAdmin, updatePayrollStatus);
router.delete('/clear-range', verifyToken, isAdmin, clearPayrollRange);
router.put('/:id', verifyToken, isAdmin, updatePayrollRecord);
router.get('/export', verifyToken, isAdmin, exportPayroll);

module.exports = router;
