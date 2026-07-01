const express = require('express');
const router = express.Router();
const { 
  getExpenseTypes, addExpenseType, updateExpenseType, deleteExpenseType,
  getExpenses, getExpenseSummary, addExpense, updateExpense, deleteExpense, exportExpenses 
} = require('../controllers/expenseController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Expense Types
router.get('/expense-types', verifyToken, isAdmin, getExpenseTypes);
router.post('/expense-types', verifyToken, isAdmin, addExpenseType);
router.put('/expense-types/:id', verifyToken, isAdmin, updateExpenseType);
router.delete('/expense-types/:id', verifyToken, isAdmin, deleteExpenseType);

// Expenses
router.get('/summary', verifyToken, isAdmin, getExpenseSummary);
router.get('/export', verifyToken, isAdmin, exportExpenses);
router.get('/', verifyToken, isAdmin, getExpenses);
router.post('/', verifyToken, isAdmin, addExpense);
router.put('/:id', verifyToken, isAdmin, updateExpense);
router.delete('/:id', verifyToken, isAdmin, deleteExpense);

module.exports = router;
