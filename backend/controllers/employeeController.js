const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

function parseMoney(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 0;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    const error = new Error(`${fieldName} must be a positive number or 0`);
    error.statusCode = 400;
    throw error;
  }
  return Number(num.toFixed(2));
}

// Get all employees
const getAllEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, d.name as department_name, 
              w.is_enabled as wfh_enabled,
              ec.is_enabled as early_checkout_enabled
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN wfh_permissions w ON e.employee_id = w.employee_id
       LEFT JOIN early_checkout_permissions ec ON e.employee_id = ec.employee_id
       ORDER BY e.employee_id ASC`
    );

    res.json({
      success: true,
      employees: result.rows
    });

  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Get single employee
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT e.*, d.name as department_name,
              w.is_enabled as wfh_enabled,
              ec.is_enabled as early_checkout_enabled
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN wfh_permissions w ON e.employee_id = w.employee_id
       LEFT JOIN early_checkout_permissions ec ON e.employee_id = ec.employee_id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    res.json({
      success: true,
      employee: result.rows[0]
    });

  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Add new employee
const addEmployee = async (req, res) => {
  try {
    const { 
      employee_id, 
      name, 
      department_id, 
      job_role, 
      mobile, 
      email, 
      password,
      date_of_birth,
      status = 'active'
    } = req.body;

    let monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds;
    try {
      monthly_salary = parseMoney(req.body.monthly_salary ?? req.body.base_salary, 'Monthly salary');
      basic_salary = parseMoney(req.body.basic_salary ?? req.body.base_salary, 'Basic salary');
      hra = parseMoney(req.body.hra, 'HRA');
      special_allowance = parseMoney(req.body.special_allowance, 'Special allowance');
      staff_advance = parseMoney(req.body.staff_advance, 'Staff advance');
      professional_tax = parseMoney(req.body.professional_tax, 'Professional tax');
      tds = parseMoney(req.body.tds, 'TDS');
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const salaryPartsProvided = basic_salary > 0 || hra > 0 || special_allowance > 0;

    if (monthly_salary > 0 && !salaryPartsProvided) {
      basic_salary = Number((monthly_salary * 0.5).toFixed(2));
      hra = Number((monthly_salary * 0.2).toFixed(2));
      special_allowance = Number((monthly_salary - basic_salary - hra).toFixed(2));
    }

    if (salaryPartsProvided) {
      const partsTotal = Number((basic_salary + hra + special_allowance).toFixed(2));
      if (monthly_salary === 0) {
        monthly_salary = partsTotal;
      } else if (Math.abs(partsTotal - monthly_salary) > 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Monthly salary must equal Basic Salary + HRA + Special Allowance'
        });
      }
    }

    // Validation
    if (!employee_id || !name || !department_id || !job_role || !mobile || !email || !password || !date_of_birth) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    // Future date validation for DOB
    if (new Date(date_of_birth) > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth cannot be in the future'
      });
    }

    // Check if employee already exists
    const checkExist = await pool.query(
      'SELECT * FROM employees WHERE employee_id = $1 OR email = $2',
      [employee_id, email]
    );

    if (checkExist.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Employee ID or Email already exists' 
      });
    }

    // Check if department is active
    const deptCheck = await pool.query(
      'SELECT status FROM departments WHERE id = $1',
      [department_id]
    );
    if (deptCheck.rows.length === 0 || deptCheck.rows[0].status !== 'Active') {
      return res.status(400).json({
        success: false,
        errorCode: 'DEPARTMENT_INACTIVE',
        message: 'This department is inactive. Please select an active department.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert employee
    const result = await pool.query(
      `INSERT INTO employees 
       (employee_id, name, department_id, job_role, mobile, email, password, status, date_of_birth, 
       monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
       RETURNING *`,
      [employee_id, name, department_id, job_role, mobile, email, hashedPassword, status, date_of_birth, 
       monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds]
    );

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.CREATE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: `Created employee ${employee_id} - ${name}`,
      newData: { employee_id, name, job_role, email, mobile, department_id, date_of_birth },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.status(201).json({
      success: true,
      message: 'Employee added successfully',
      employee: result.rows[0]
    });

  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      department_id, 
      job_role, 
      mobile, 
      email, 
      status,
      password,
      date_of_birth
    } = req.body;

    let monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds;
    try {
      monthly_salary = parseMoney(req.body.monthly_salary ?? req.body.base_salary, 'Monthly salary');
      basic_salary = parseMoney(req.body.basic_salary ?? req.body.base_salary, 'Basic salary');
      hra = parseMoney(req.body.hra, 'HRA');
      special_allowance = parseMoney(req.body.special_allowance, 'Special allowance');
      staff_advance = parseMoney(req.body.staff_advance, 'Staff advance');
      professional_tax = parseMoney(req.body.professional_tax, 'Professional tax');
      tds = parseMoney(req.body.tds, 'TDS');
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const salaryPartsProvided = basic_salary > 0 || hra > 0 || special_allowance > 0;

    if (monthly_salary > 0 && !salaryPartsProvided) {
      basic_salary = Number((monthly_salary * 0.5).toFixed(2));
      hra = Number((monthly_salary * 0.2).toFixed(2));
      special_allowance = Number((monthly_salary - basic_salary - hra).toFixed(2));
    }

    if (salaryPartsProvided) {
      const partsTotal = Number((basic_salary + hra + special_allowance).toFixed(2));
      if (monthly_salary === 0) {
        monthly_salary = partsTotal;
      } else if (Math.abs(partsTotal - monthly_salary) > 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Monthly salary must equal Basic Salary + HRA + Special Allowance'
        });
      }
    }

    if (!date_of_birth) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth is required'
      });
    }

    if (new Date(date_of_birth) > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Date of birth cannot be in the future'
      });
    }

    // Check if employee exists
    const checkResult = await pool.query(
      'SELECT * FROM employees WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    const oldData = { 
      name: checkResult.rows[0].name, 
      email: checkResult.rows[0].email, 
      job_role: checkResult.rows[0].job_role,
      mobile: checkResult.rows[0].mobile,
      department_id: checkResult.rows[0].department_id,
      status: checkResult.rows[0].status
    };

    // Check if department is active
    if (department_id) {
      const deptCheck = await pool.query(
        'SELECT status FROM departments WHERE id = $1',
        [department_id]
      );
      if (deptCheck.rows.length === 0 || deptCheck.rows[0].status !== 'Active') {
        return res.status(400).json({
          success: false,
          errorCode: 'DEPARTMENT_INACTIVE',
          message: 'This department is inactive. Please select an active department.'
        });
      }
    }

    let query;
    let values;

    // If password is provided, hash it and update
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `UPDATE employees 
               SET name = $1, department_id = $2, job_role = $3, 
                   mobile = $4, email = $5, status = $6, password = $7, 
                   date_of_birth = $8, monthly_salary = $9, basic_salary = $10, hra = $11, 
                   special_allowance = $12, staff_advance = $13, professional_tax = $14, tds = $15, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $16 
               RETURNING *`;
      values = [name, department_id, job_role, mobile, email, status, hashedPassword, date_of_birth, 
                monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds, id];
    } else {
      query = `UPDATE employees 
               SET name = $1, department_id = $2, job_role = $3, 
                   mobile = $4, email = $5, status = $6, 
                   date_of_birth = $7, monthly_salary = $8, basic_salary = $9, hra = $10, 
                   special_allowance = $11, staff_advance = $12, professional_tax = $13, tds = $14, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $15 
               RETURNING *`;
      values = [name, department_id, job_role, mobile, email, status, date_of_birth, 
                monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds, id];
    }

    const result = await pool.query(query, values);

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: `Updated employee ${checkResult.rows[0].employee_id} - ${name}`,
      oldData,
      newData: { name, email, job_role, mobile, department_id, status, date_of_birth, passwordChanged: !!password },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Employee updated successfully',
      employee: result.rows[0]
    });

  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Delete employee
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.DELETE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: `Deleted employee ${result.rows[0].employee_id} - ${result.rows[0].name}`,
      oldData: { employee_id: result.rows[0].employee_id, name: result.rows[0].name, email: result.rows[0].email },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Get all departments
const getAllDepartments = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name');

    res.json({
      success: true,
      departments: result.rows
    });

  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getAllDepartments
};
