const express = require('express');
const router = express.Router();
const { 
  getExpenseTypes, getActiveExpenseTypes, addExpenseType, updateExpenseType, deleteExpenseType,
  getExpenses, getExpenseSummary, addExpense, updateExpense, deleteExpense, exportExpenses, clearExpenseRange 
} = require('../controllers/expenseController');
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');

// Expense Types
router.get('/expense-types', verifyToken, isAdmin, requirePermission('expenses', 'can_view'), getExpenseTypes);
router.get('/expense-types/active', verifyToken, isAdmin, requirePermission('expenses', 'can_view'), getActiveExpenseTypes);
router.post('/expense-types', verifyToken, isAdmin, requirePermission('expenses', 'can_create'), addExpenseType);
router.put('/expense-types/:id', verifyToken, isAdmin, requirePermission('expenses', 'can_edit'), updateExpenseType);
router.delete('/expense-types/:id', verifyToken, isAdmin, requirePermission('expenses', 'can_delete'), deleteExpenseType);

// Expenses
router.get('/summary', verifyToken, isAdmin, requirePermission('expenses', 'can_view'), getExpenseSummary);
router.get('/export', verifyToken, isAdmin, requirePermission('expenses', 'can_export'), exportExpenses);
router.get('/', verifyToken, isAdmin, requirePermission('expenses', 'can_view'), getExpenses);
router.post('/', verifyToken, isAdmin, requirePermission('expenses', 'can_create'), addExpense);
router.delete('/clear-range', verifyToken, isAdmin, requirePermission('expenses', 'can_clear'), clearExpenseRange);
router.put('/:id', verifyToken, isAdmin, requirePermission('expenses', 'can_edit'), updateExpense);
router.delete('/:id', verifyToken, isAdmin, requirePermission('expenses', 'can_delete'), deleteExpense);

module.exports = router;
