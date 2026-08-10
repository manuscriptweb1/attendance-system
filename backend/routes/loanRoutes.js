const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  previewRepaymentSchedule,
  createLoan,
  getAllLoans,
  getLoanSummary,
  getLoanById,
  getRepaymentHistory,
  updateLoan,
  cancelLoan,
  deleteLoan,
  reverseTransaction,
  triggerMonthEndProcessing,
  exportLoansExcel
} = require('../controllers/loanController');

// All routes require authenticated Admin with Payroll permissions
router.use(verifyToken, isAdmin);

// Summary & List
router.get('/summary', requirePermission('payroll', 'can_view'), getLoanSummary);
router.get('/export', requirePermission('payroll', 'can_export'), exportLoansExcel);
router.get('/', requirePermission('payroll', 'can_view'), getAllLoans);
router.get('/:id', requirePermission('payroll', 'can_view'), getLoanById);
router.get('/:id/transactions', requirePermission('payroll', 'can_view'), getRepaymentHistory);

// Preview & Create
router.post('/preview-schedule', requirePermission('payroll', 'can_create'), previewRepaymentSchedule);
router.post('/', requirePermission('payroll', 'can_create'), createLoan);

// Edit & Actions
router.put('/:id', requirePermission('payroll', 'can_edit'), updateLoan);
router.post('/:id/cancel', requirePermission('payroll', 'can_edit'), cancelLoan);
router.delete('/:id', requirePermission('payroll', 'can_delete'), deleteLoan);

// Reversal & Manual Trigger
router.post('/reversal', requirePermission('payroll', 'can_approve'), reverseTransaction);
router.post('/trigger-month-end', requirePermission('payroll', 'can_calculate'), triggerMonthEndProcessing);

module.exports = router;
