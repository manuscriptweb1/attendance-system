const express = require('express');
const router = express.Router();
const { getPayrollRecords, calculatePayroll, updatePayrollStatus, exportPayroll } = require('../controllers/payrollController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, getPayrollRecords);
router.post('/calculate', verifyToken, isAdmin, calculatePayroll);
router.patch('/:id/status', verifyToken, isAdmin, updatePayrollStatus);
router.get('/export', verifyToken, isAdmin, exportPayroll);

module.exports = router;
