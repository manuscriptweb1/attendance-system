const pool = require('../config/database');
const exceljs = require('exceljs');

// --- Expense Types ---
const getExpenseTypes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expense_types ORDER BY name ASC');
    if (result.rows.length === 0) {
      // Seed default expense types
      const defaults = ['Freelancers', 'Rent', 'Office Staff', 'Utilities', 'Other'];
      for (const name of defaults) {
        await pool.query(
          'INSERT INTO expense_types (name) VALUES ($1) ON CONFLICT DO NOTHING',
          [name]
        );
      }
      const newResult = await pool.query('SELECT * FROM expense_types ORDER BY name ASC');
      return res.json({ success: true, expenseTypes: newResult.rows });
    }
    res.json({ success: true, expenseTypes: result.rows });
  } catch (error) {
    console.error('Get expense types error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addExpenseType = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const result = await pool.query(
      'INSERT INTO expense_types (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.json({ success: true, expenseType: result.rows[0] });
  } catch (error) {
    console.error('Add expense type error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateExpenseType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    
    const result = await pool.query(
      'UPDATE expense_types SET name = $1, description = $2, is_active = $3 WHERE id = $4 RETURNING *',
      [name, description, is_active, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, expenseType: result.rows[0] });
  } catch (error) {
    console.error('Update expense type error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteExpenseType = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM expense_types WHERE id = $1', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete expense type error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- Expenses ---
const getExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = `
      SELECT e.*, et.name as expense_type_name 
      FROM monthly_expenses e
      LEFT JOIN expense_types et ON e.expense_type_id = et.id
    `;
    const values = [];

    if (month && year) {
      query += ` WHERE e.expense_month = $1 AND e.expense_year = $2`;
      values.push(month, year);
    }
    query += ' ORDER BY e.expense_date DESC';

    const result = await pool.query(query, values);
    res.json({ success: true, expenses: result.rows });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getExpenseSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    const result = await pool.query(
      `SELECT status, payment_mode, SUM(amount) as total 
       FROM monthly_expenses 
       WHERE expense_month = $1 AND expense_year = $2
       GROUP BY status, payment_mode`,
      [month, year]
    );

    let totalExpenses = 0;
    let unpaid = 0;
    let totalPaid = 0;
    let pettyCash = 0;
    let bank = 0;

    result.rows.forEach(row => {
      const amount = parseFloat(row.total);
      totalExpenses += amount;
      
      if (row.status === 'unpaid') {
        unpaid += amount;
      } else {
        totalPaid += amount;
        if (row.payment_mode === 'petty_cash') {
          pettyCash += amount;
        } else if (['bank', 'upi'].includes(row.payment_mode)) {
          bank += amount;
        }
      }
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const period = `${monthNames[month - 1]} ${year}`;

    res.json({
      success: true,
      summary: {
        totalExpenses,
        unpaid,
        totalPaid,
        pettyCash,
        bank,
        period
      }
    });

  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addExpense = async (req, res) => {
  try {
    const { expense_type_id, title, description, amount, expense_date, payment_mode, status, paid_to } = req.body;
    
    if (!title || !amount || !expense_date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const dateObj = new Date(expense_date);
    const expense_month = dateObj.getMonth() + 1;
    const expense_year = dateObj.getFullYear();

    const result = await pool.query(
      `INSERT INTO monthly_expenses 
       (expense_type_id, title, description, amount, expense_date, expense_month, expense_year, payment_mode, status, paid_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [expense_type_id || null, title, description, amount, expense_date, expense_month, expense_year, payment_mode, status, paid_to, req.user.id]
    );

    res.json({ success: true, expense: result.rows[0] });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { expense_type_id, title, description, amount, expense_date, payment_mode, status, paid_to } = req.body;
    
    const dateObj = new Date(expense_date);
    const expense_month = dateObj.getMonth() + 1;
    const expense_year = dateObj.getFullYear();

    const result = await pool.query(
      `UPDATE monthly_expenses 
       SET expense_type_id = $1, title = $2, description = $3, amount = $4, 
           expense_date = $5, expense_month = $6, expense_year = $7, 
           payment_mode = $8, status = $9, paid_to = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 RETURNING *`,
      [expense_type_id || null, title, description, amount, expense_date, expense_month, expense_year, payment_mode, status, paid_to, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, expense: result.rows[0] });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM monthly_expenses WHERE id = $1', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const exportExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    const result = await pool.query(
      `SELECT e.*, et.name as expense_type_name 
       FROM monthly_expenses e
       LEFT JOIN expense_types et ON e.expense_type_id = et.id
       WHERE e.expense_month = $1 AND e.expense_year = $2
       ORDER BY e.expense_date DESC`,
      [month, year]
    );

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    worksheet.columns = [
      { header: 'Date', key: 'expense_date', width: 15 },
      { header: 'Type', key: 'expense_type_name', width: 20 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Payment Mode', key: 'payment_mode', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Paid To', key: 'paid_to', width: 25 },
      { header: 'Description', key: 'description', width: 40 },
    ];

    result.rows.forEach(row => {
      // Format date to local date string format for Excel
      const d = new Date(row.expense_date);
      row.expense_date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });

    worksheet.addRows(result.rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expenses_${month}_${year}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export expenses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getExpenseTypes,
  addExpenseType,
  updateExpenseType,
  deleteExpenseType,
  getExpenses,
  getExpenseSummary,
  addExpense,
  updateExpense,
  deleteExpense,
  exportExpenses
};
