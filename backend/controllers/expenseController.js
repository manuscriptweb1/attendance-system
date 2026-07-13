const pool = require('../config/database');
const exceljs = require('exceljs');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');

// --- Expense Types ---
const getExpenseTypes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expense_types ORDER BY name ASC');
    if (result.rows.length === 0) {
      // Seed default expense types
      const defaults = ['Freelancer', 'Rent', 'Office Staff', 'Editorial Expenses', 'Reviewer Expenses'];
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

const getActiveExpenseTypes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expense_types WHERE is_active = true ORDER BY name ASC');
    res.json({ success: true, expenseTypes: result.rows });
  } catch (error) {
    console.error('Get active expense types error:', error);
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

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.CREATE_EXPENSE_TYPE,
      moduleName: 'Expense Types',
      description: `Created expense type '${name}'.`,
      newData: result.rows[0],
      ipAddress: req.ip
    });

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
    
    const oldRecord = await pool.query('SELECT * FROM expense_types WHERE id = $1', [id]);
    if (oldRecord.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    
    const result = await pool.query(
      'UPDATE expense_types SET name = $1, description = $2, is_active = $3 WHERE id = $4 RETURNING *',
      [name, description, is_active, id]
    );
    
    const oldData = oldRecord.rows[0];
    const newData = result.rows[0];
    
    let descriptionStr = `Updated expense type '${oldData.name}'.`;
    if (oldData.is_active !== newData.is_active) {
      descriptionStr = newData.is_active ? `Activated expense type '${newData.name}'.` : `Deactivated expense type '${newData.name}'.`;
    }

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_EXPENSE_TYPE,
      moduleName: 'Expense Types',
      description: descriptionStr,
      oldData,
      newData,
      ipAddress: req.ip
    });

    res.json({ success: true, expenseType: result.rows[0] });
  } catch (error) {
    console.error('Update expense type error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteExpenseType = async (req, res) => {
  try {
    const { id } = req.params;
    
    const oldRecord = await pool.query('SELECT * FROM expense_types WHERE id = $1', [id]);
    if (oldRecord.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    
    // Check if it's used
    const checkResult = await pool.query('SELECT COUNT(*) FROM monthly_expenses WHERE expense_type_id = $1', [id]);
    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({ success: false, message: 'This expense type is already used. Please deactivate it instead.' });
    }
    
    await pool.query('DELETE FROM expense_types WHERE id = $1', [id]);

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.DELETE_EXPENSE_TYPE,
      moduleName: 'Expense Types',
      description: `Deleted expense type '${oldRecord.rows[0].name}'.`,
      oldData: oldRecord.rows[0],
      ipAddress: req.ip
    });

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
      `SELECT payment_status as status, payment_method as payment_mode, SUM(amount) as total 
       FROM monthly_expenses 
       WHERE expense_month = $1 AND expense_year = $2
       GROUP BY payment_status, payment_method`,
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
        if (row.payment_mode === 'petty_cash' || row.payment_mode === 'Petty Cash') {
          pettyCash += amount;
        } else if (['bank', 'upi', 'Bank'].includes(row.payment_mode)) {
          bank += amount;
        }
      }
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const period = `${monthNames[month - 1]} ${year}`;

    // Get Summary by Type
    const typeSummaryResult = await pool.query(`
      SELECT et.name, COALESCE(SUM(me.amount), 0) as total_amount, COUNT(me.id) as entry_count
      FROM expense_types et
      LEFT JOIN monthly_expenses me ON et.id = me.expense_type_id 
        AND me.expense_month = $1 AND me.expense_year = $2
      WHERE et.is_active = true OR me.id IS NOT NULL
      GROUP BY et.id, et.name
      ORDER BY et.name
    `, [month, year]);

    res.json({
      success: true,
      summary: {
        totalExpenses,
        unpaid,
        totalPaid,
        pettyCash,
        bank,
        period,
        byType: typeSummaryResult.rows.map(row => ({
          name: row.name,
          amount: parseFloat(row.total_amount),
          count: parseInt(row.entry_count)
        }))
      }
    });

  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addExpense = async (req, res) => {
  try {
    const { expense_type_id, name, notes, amount, payment_method, payment_status, paid_to } = req.body;
    
    if (!name || !amount) {
      return res.status(400).json({ success: false, message: 'Name and amount are required' });
    }

    if (expense_type_id) {
      const typeCheck = await pool.query('SELECT is_active FROM expense_types WHERE id = $1', [expense_type_id]);
      if (typeCheck.rows.length === 0 || typeCheck.rows[0].is_active !== true) {
        return res.status(400).json({ success: false, message: 'Inactive expense type cannot be selected' });
      }
    }

    // Auto set date
    const dateObj = new Date();
    const expense_date = dateObj.toISOString().split('T')[0];
    const expense_month = dateObj.getMonth() + 1;
    const expense_year = dateObj.getFullYear();

    const result = await pool.query(
      `INSERT INTO monthly_expenses 
       (expense_type_id, title, name, description, notes, amount, expense_date, expense_month, expense_year, payment_mode, payment_method, status, payment_status, paid_to, created_by)
       VALUES ($1, $2, $2, $3, $3, $4, $5, $6, $7, $8, $8, $9, $9, $10, $11) RETURNING *`,
      [expense_type_id || null, name, notes, amount, expense_date, expense_month, expense_year, payment_method, payment_status, paid_to, req.user.id]
    );

    let typeName = 'General';
    if (expense_type_id) {
      const typeRes = await pool.query('SELECT name FROM expense_types WHERE id = $1', [expense_type_id]);
      if (typeRes.rows.length > 0) typeName = typeRes.rows[0].name;
    }

    const exp = result.rows[0];
    const logDesc = `Created expense '${exp.name}' under ${typeName} for ₹${exp.amount}. Payment status: ${exp.payment_status || 'Unpaid'}. Payment method: ${exp.payment_method || 'N/A'}. Date: ${expense_date}.`;

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.CREATE_EXPENSE,
      moduleName: MODULE_NAMES.EXPENSES,
      description: logDesc,
      newData: exp,
      ipAddress: req.ip
    });

    res.json({ success: true, expense: exp });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { expense_type_id, name, notes, amount, payment_method, payment_status, paid_to, expense_date } = req.body;

    if (expense_type_id) {
      const typeCheck = await pool.query('SELECT is_active FROM expense_types WHERE id = $1', [expense_type_id]);
      if (typeCheck.rows.length === 0 || typeCheck.rows[0].is_active !== true) {
        return res.status(400).json({ success: false, message: 'Inactive expense type cannot be selected' });
      }
    }
    
    const dateObj = new Date(expense_date || new Date());
    const expense_month = dateObj.getMonth() + 1;
    const expense_year = dateObj.getFullYear();

    const oldRecordRes = await pool.query(`
      SELECT me.*, et.name as expense_type_name 
      FROM monthly_expenses me
      LEFT JOIN expense_types et ON me.expense_type_id = et.id
      WHERE me.id = $1`, [id]
    );
    if (oldRecordRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    const oldData = oldRecordRes.rows[0];

    const result = await pool.query(
      `UPDATE monthly_expenses 
       SET expense_type_id = $1, title = $2, name = $2, description = $3, notes = $3, amount = $4, 
           expense_date = $5, expense_month = $6, expense_year = $7, 
           payment_mode = $8, payment_method = $8, status = $9, payment_status = $9, paid_to = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 RETURNING *`,
      [expense_type_id || null, name, notes, amount, dateObj.toISOString().split('T')[0], expense_month, expense_year, payment_method, payment_status, paid_to, id]
    );
    const newData = result.rows[0];

    let changes = [];
    if (parseFloat(oldData.amount) !== parseFloat(newData.amount)) {
      changes.push(`Amount changed from ₹${oldData.amount} to ₹${newData.amount}`);
    }
    if (oldData.payment_status !== newData.payment_status) {
      changes.push(`Payment status changed from ${oldData.payment_status || 'Unpaid'} to ${newData.payment_status || 'Unpaid'}`);
    }
    if (oldData.payment_method !== newData.payment_method) {
      changes.push(`Payment method changed from ${oldData.payment_method || 'N/A'} to ${newData.payment_method || 'N/A'}`);
    }
    if (oldData.name !== newData.name) {
      changes.push(`Name changed from '${oldData.name}' to '${newData.name}'`);
    }
    if (oldData.expense_type_id != newData.expense_type_id) {
      let newTypeName = 'General';
      if (newData.expense_type_id) {
        const typeRes = await pool.query('SELECT name FROM expense_types WHERE id = $1', [newData.expense_type_id]);
        if (typeRes.rows.length > 0) newTypeName = typeRes.rows[0].name;
      }
      changes.push(`Expense type changed from ${oldData.expense_type_name || 'General'} to ${newTypeName}`);
    }
    const oldDateStr = new Date(oldData.expense_date).toISOString().split('T')[0];
    const newDateStr = new Date(newData.expense_date).toISOString().split('T')[0];
    if (oldDateStr !== newDateStr) {
      changes.push(`Payment date changed from ${oldDateStr} to ${newDateStr}`);
    }
    if (oldData.notes !== newData.notes) {
      changes.push(`Notes updated`);
    }

    if (changes.length > 0) {
      await logAdminActivity({
        adminId: req.user.id,
        adminName: req.user.username,
        adminEmail: req.user.email || '',
        actionType: ADMIN_ACTION_TYPES.UPDATE_EXPENSE,
        moduleName: MODULE_NAMES.EXPENSES,
        description: `Updated expense '${oldData.name}'. ${changes.join('; ')}`,
        oldData,
        newData,
        ipAddress: req.ip
      });
    }

    res.json({ success: true, expense: newData });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    
    const oldRecordRes = await pool.query(`
      SELECT me.*, et.name as expense_type_name 
      FROM monthly_expenses me
      LEFT JOIN expense_types et ON me.expense_type_id = et.id
      WHERE me.id = $1`, [id]
    );
    if (oldRecordRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    const exp = oldRecordRes.rows[0];

    await pool.query('DELETE FROM monthly_expenses WHERE id = $1', [id]);

    const oldDateStr = new Date(exp.expense_date).toISOString().split('T')[0];
    const logDesc = `Deleted expense '${exp.name}' under ${exp.expense_type_name || 'General'} for ₹${exp.amount}. Payment status: ${exp.payment_status || 'Unpaid'}. Payment method: ${exp.payment_method || 'N/A'}. Date: ${oldDateStr}.`;

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.DELETE_EXPENSE,
      moduleName: MODULE_NAMES.EXPENSES,
      description: logDesc,
      oldData: exp,
      ipAddress: req.ip
    });

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
      { header: 'Expense Date', key: 'expense_date', width: 15 },
      { header: 'Expense Type', key: 'expense_type_name', width: 20 },
      { header: 'Name / Description', key: 'name', width: 30 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Payment Method', key: 'payment_method', width: 15 },
      { header: 'Payment Status', key: 'payment_status', width: 15 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Created At', key: 'created_at', width: 25 },
    ];

    result.rows.forEach(row => {
      const d = new Date(row.expense_date);
      row.expense_date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const cd = new Date(row.created_at);
      row.created_at = cd.toLocaleString();
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

/**
 * @desc    Clear expense records for a date range
 * @route   DELETE /api/expenses/clear-range
 * @access  Private/Admin
 */
const clearExpenseRange = async (req, res) => {
  try {
    const { fromDate, toDate, confirmText } = req.body;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'From Date and To Date are required' });
    }
    
    if (confirmText !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Invalid confirmation text' });
    }
    
    if (new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({ success: false, message: 'From Date cannot be after To Date' });
    }


    const adminId = req.user.id;
    const adminName = req.user.username;

    const result = await pool.query(
      'DELETE FROM monthly_expenses WHERE expense_date BETWEEN $1 AND $2 RETURNING id',
      [fromDate, toDate]
    );

    // Log the action
    await logAdminActivity({
      adminId,
      adminName,
      actionType: ADMIN_ACTION_TYPES.CLEAR_RANGE,
      moduleName: MODULE_NAMES.EXPENSES,
      description: `Cleared expense records from ${fromDate} to ${toDate}. Count: ${result.rowCount}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Expense records cleared successfully',
      deletedCount: result.rowCount
    });

  } catch (error) {
    console.error('Clear expense range error:', error);
    res.status(500).json({ success: false, message: 'Server error while clearing records' });
  }
};

module.exports = {
  getExpenseTypes,
  getActiveExpenseTypes,
  addExpenseType,
  updateExpenseType,
  deleteExpenseType,
  getExpenses,
  getExpenseSummary,
  addExpense,
  updateExpense,
  deleteExpense,
  exportExpenses,
  clearExpenseRange
};
