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
      joining_date,
      status = 'active',
      bank_name,
      bank_address,
      account_holder_name,
      account_number,
      ifsc_code,
      pan_card_number,
      aadhar_card_number,
      permanent_address,
      alternate_phone_number
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

    if (aadhar_card_number) {
      const aadharStr = aadhar_card_number.replace(/\s/g, '');
      if (aadharStr.length !== 12 || !/^\d+$/.test(aadharStr)) {
        return res.status(400).json({ success: false, message: 'Aadhaar number must be exactly 12 digits.' });
      }
    }
    
    if (pan_card_number) {
      const panStr = pan_card_number.toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panStr)) {
        return res.status(400).json({ success: false, message: 'PAN format must be 5 letters, 4 digits, and 1 letter. Example: ABCDE1234F.' });
      }
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

    const formatted_ifsc = ifsc_code ? ifsc_code.toUpperCase().substring(0, 20) : null;
    const formatted_pan = pan_card_number ? pan_card_number.toUpperCase().substring(0, 20) : null;
    const formatted_aadhar = aadhar_card_number ? aadhar_card_number.replace(/[^0-9\s]/g, '').substring(0, 20) : null;
    const formatted_account = account_number ? account_number.substring(0, 50) : null;
    const formatted_alt_phone = alternate_phone_number ? alternate_phone_number.substring(0, 20) : null;

    // Insert employee
    const result = await pool.query(
      `INSERT INTO employees 
       (employee_id, name, department_id, job_role, mobile, email, password, status, date_of_birth, joining_date,
       monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds,
       bank_name, bank_address, account_holder_name, account_number, ifsc_code, pan_card_number, aadhar_card_number, permanent_address, alternate_phone_number) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26) 
       RETURNING *`,
      [employee_id, name, department_id, job_role, mobile, email, hashedPassword, status, date_of_birth, joining_date || null,
       monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds,
       bank_name || null, bank_address || null, account_holder_name || null, formatted_account, formatted_ifsc, formatted_pan, formatted_aadhar, permanent_address || null, formatted_alt_phone]
    );

    // Log activity
    const maskedAccount = formatted_account ? '*'.repeat(Math.max(0, formatted_account.length - 4)) + formatted_account.slice(-4) : null;
    const maskedPan = formatted_pan ? '*'.repeat(Math.max(0, formatted_pan.length - 4)) + formatted_pan.slice(-4) : null;
    const maskedAadhar = formatted_aadhar ? '*'.repeat(Math.max(0, formatted_aadhar.length - 4)) + formatted_aadhar.slice(-4) : null;

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.CREATE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: `Created employee ${employee_id} - ${name}`,
      newData: { 
        employee_id, name, job_role, email, mobile, department_id, date_of_birth, joining_date,
        ...(bank_name && { bank_name }),
        ...(maskedAccount && { account_number: maskedAccount }),
        ...(maskedPan && { pan_card_number: maskedPan }),
        ...(maskedAadhar && { aadhar_card_number: maskedAadhar })
      },
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
      date_of_birth,
      joining_date,
      bank_name,
      bank_address,
      account_holder_name,
      account_number,
      ifsc_code,
      pan_card_number,
      aadhar_card_number,
      permanent_address,
      alternate_phone_number
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

    if (aadhar_card_number) {
      const aadharStr = aadhar_card_number.replace(/\s/g, '');
      if (aadharStr.length !== 12 || !/^\d+$/.test(aadharStr)) {
        return res.status(400).json({ success: false, message: 'Aadhaar number must be exactly 12 digits.' });
      }
    }
    
    if (pan_card_number) {
      const panStr = pan_card_number.toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panStr)) {
        return res.status(400).json({ success: false, message: 'PAN format must be 5 letters, 4 digits, and 1 letter. Example: ABCDE1234F.' });
      }
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
      status: checkResult.rows[0].status,
      joining_date: checkResult.rows[0].joining_date
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

    const formatted_ifsc = ifsc_code ? ifsc_code.toUpperCase().substring(0, 20) : null;
    const formatted_pan = pan_card_number ? pan_card_number.toUpperCase().substring(0, 20) : null;
    const formatted_aadhar = aadhar_card_number ? aadhar_card_number.replace(/[^0-9\s]/g, '').substring(0, 20) : null;
    const formatted_account = account_number ? account_number.substring(0, 50) : null;
    const formatted_alt_phone = alternate_phone_number ? alternate_phone_number.substring(0, 20) : null;

    // If password is provided, hash it and update
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `UPDATE employees 
               SET name = $1, department_id = $2, job_role = $3, 
                   mobile = $4, email = $5, status = $6, password = $7, 
                   date_of_birth = $8, joining_date = $9, monthly_salary = $10, basic_salary = $11, hra = $12, 
                   special_allowance = $13, staff_advance = $14, professional_tax = $15, tds = $16,
                   bank_name = $17, bank_address = $18, account_holder_name = $19, account_number = $20,
                   ifsc_code = $21, pan_card_number = $22, aadhar_card_number = $23, permanent_address = $24,
                   alternate_phone_number = $25, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $26 
               RETURNING *`;
      values = [name, department_id, job_role, mobile, email, status, hashedPassword, date_of_birth, joining_date || null,
                monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds,
                bank_name || null, bank_address || null, account_holder_name || null, formatted_account, formatted_ifsc, formatted_pan, formatted_aadhar, permanent_address || null, formatted_alt_phone, id];
    } else {
      query = `UPDATE employees 
               SET name = $1, department_id = $2, job_role = $3, 
                   mobile = $4, email = $5, status = $6, 
                   date_of_birth = $7, joining_date = $8, monthly_salary = $9, basic_salary = $10, hra = $11, 
                   special_allowance = $12, staff_advance = $13, professional_tax = $14, tds = $15,
                   bank_name = $16, bank_address = $17, account_holder_name = $18, account_number = $19,
                   ifsc_code = $20, pan_card_number = $21, aadhar_card_number = $22, permanent_address = $23,
                   alternate_phone_number = $24, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $25 
               RETURNING *`;
      values = [name, department_id, job_role, mobile, email, status, date_of_birth, joining_date || null,
                monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds,
                bank_name || null, bank_address || null, account_holder_name || null, formatted_account, formatted_ifsc, formatted_pan, formatted_aadhar, permanent_address || null, formatted_alt_phone, id];
    }

    const result = await pool.query(query, values);

    // Determine what changed for the activity log description
    const oldEmp = checkResult.rows[0];
    
    const bankFieldsChanged = (
      (oldEmp.bank_name || '') !== (bank_name || '') ||
      (oldEmp.bank_address || '') !== (bank_address || '') ||
      (oldEmp.account_holder_name || '') !== (account_holder_name || '') ||
      (oldEmp.account_number || '') !== (formatted_account || '') ||
      (oldEmp.ifsc_code || '') !== (formatted_ifsc || '')
    );
    
    const personalFieldsChanged = (
      (oldEmp.pan_card_number || '') !== (formatted_pan || '') ||
      (oldEmp.aadhar_card_number || '') !== (formatted_aadhar || '') ||
      (oldEmp.permanent_address || '') !== (permanent_address || '') ||
      (oldEmp.alternate_phone_number || '') !== (formatted_alt_phone || '')
    );

    const normalFieldsChanged = (
      (oldEmp.name || '') !== (name || '') ||
      String(oldEmp.department_id || '') !== String(department_id || '') ||
      (oldEmp.job_role || '') !== (job_role || '') ||
      (oldEmp.mobile || '') !== (mobile || '') ||
      (oldEmp.email || '') !== (email || '') ||
      (oldEmp.status || '') !== (status || '') ||
      Number(oldEmp.monthly_salary || 0) !== Number(monthly_salary || 0) ||
      !!password
    );

    let logDescription = `Updated employee ${oldEmp.employee_id} - ${name}`;
    if (bankFieldsChanged && personalFieldsChanged && !normalFieldsChanged) {
      logDescription = `Updated bank account and personal details for ${oldEmp.employee_id} - ${name}`;
    } else if (bankFieldsChanged && !personalFieldsChanged && !normalFieldsChanged) {
      logDescription = `Updated bank account details for ${oldEmp.employee_id} - ${name}`;
    } else if (personalFieldsChanged && !bankFieldsChanged && !normalFieldsChanged) {
      logDescription = `Updated personal details for ${oldEmp.employee_id} - ${name}`;
    } else if ((bankFieldsChanged || personalFieldsChanged) && normalFieldsChanged) {
      logDescription = `Updated employee and account/personal details for ${oldEmp.employee_id} - ${name}`;
    }

    // Log activity
    const maskedAccount = formatted_account ? '*'.repeat(Math.max(0, formatted_account.length - 4)) + formatted_account.slice(-4) : null;
    const maskedPan = formatted_pan ? '*'.repeat(Math.max(0, formatted_pan.length - 4)) + formatted_pan.slice(-4) : null;
    const maskedAadhar = formatted_aadhar ? '*'.repeat(Math.max(0, formatted_aadhar.length - 4)) + formatted_aadhar.slice(-4) : null;

    const newMaskedData = { 
      name, email, job_role, mobile, department_id, status, date_of_birth, joining_date, passwordChanged: !!password 
    };

    if (bankFieldsChanged) {
      newMaskedData.bank_details_updated = true;
      if (bank_name) newMaskedData.bank_name = bank_name;
      if (maskedAccount) newMaskedData.account_number = maskedAccount;
    }
    
    if (personalFieldsChanged) {
      newMaskedData.personal_details_updated = true;
      if (maskedPan) newMaskedData.pan_card_number = maskedPan;
      if (maskedAadhar) newMaskedData.aadhar_card_number = maskedAadhar;
    }

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: logDescription,
      oldData,
      newData: newMaskedData,
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

// Delete employee (moves employee to resigned_employees table)
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists first
    const empRes = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Employee not found' 
      });
    }

    const emp = empRes.rows[0];

    // Insert into resigned_employees table
    await pool.query(
      `INSERT INTO resigned_employees (
        original_id, employee_id, name, department_id, job_role, mobile, email, password, status,
        date_of_birth, joining_date, resigned_date, monthly_salary, basic_salary, hra, special_allowance,
        staff_advance, professional_tax, tds, bank_name, bank_address, account_holder_name, account_number,
        ifsc_code, pan_card_number, aadhar_card_number, permanent_address, alternate_phone_number, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'Resigned',
        $9, $10, CURRENT_DATE, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27
      )`,
      [
        emp.id, emp.employee_id, emp.name, emp.department_id, emp.job_role, emp.mobile, emp.email, emp.password,
        emp.date_of_birth, emp.joining_date, emp.monthly_salary || 0, emp.basic_salary || 0, emp.hra || 0, emp.special_allowance || 0,
        emp.staff_advance || 0, emp.professional_tax || 0, emp.tds || 0, emp.bank_name || null, emp.bank_address || null, emp.account_holder_name || null, emp.account_number || null,
        emp.ifsc_code || null, emp.pan_card_number || null, emp.aadhar_card_number || null, emp.permanent_address || null, emp.alternate_phone_number || null, emp.created_at || new Date()
      ]
    );

    // Delete from active employees
    await pool.query('DELETE FROM employees WHERE id = $1', [id]);

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.DELETE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: `Moved employee ${emp.employee_id} - ${emp.name} to Resigned Employees`,
      oldData: { employee_id: emp.employee_id, name: emp.name, email: emp.email },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Employee moved to Resigned Employees successfully'
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Get all resigned employees
const getResignedEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, d.name as department_name
       FROM resigned_employees r
       LEFT JOIN departments d ON r.department_id = d.id
       ORDER BY r.resigned_date DESC, r.id DESC`
    );

    res.json({
      success: true,
      employees: result.rows
    });
  } catch (error) {
    console.error('Get resigned employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update resigned date for a resigned employee
const updateResignedEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { resigned_date } = req.body;

    if (!resigned_date) {
      return res.status(400).json({
        success: false,
        message: 'Resigned / Quit Date is required'
      });
    }

    const checkRes = await pool.query('SELECT * FROM resigned_employees WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resigned employee record not found'
      });
    }

    const result = await pool.query(
      `UPDATE resigned_employees
       SET resigned_date = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [resigned_date, id]
    );

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: `Updated resigned date for former employee ${result.rows[0].employee_id} - ${result.rows[0].name} to ${resigned_date}`,
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Resigned date updated successfully',
      employee: result.rows[0]
    });
  } catch (error) {
    console.error('Update resigned employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Permanently delete a resigned employee
const deleteResignedEmployeePermanently = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM resigned_employees WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resigned employee record not found'
      });
    }

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.DELETE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: `Permanently deleted resigned employee record ${result.rows[0].employee_id} - ${result.rows[0].name}`,
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Resigned employee record deleted permanently'
    });
  } catch (error) {
    console.error('Delete resigned employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Restore a resigned employee back to active employees table
const restoreResignedEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const checkRes = await pool.query('SELECT * FROM resigned_employees WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resigned employee record not found'
      });
    }

    const emp = checkRes.rows[0];

    // Check if employee_id or email already exists in employees table
    const existCheck = await pool.query(
      'SELECT * FROM employees WHERE employee_id = $1 OR email = $2',
      [emp.employee_id, emp.email]
    );

    if (existCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An active employee with the same Employee ID or Email already exists'
      });
    }

    // Insert back into employees
    const restored = await pool.query(
      `INSERT INTO employees (
        employee_id, name, department_id, job_role, mobile, email, password, status,
        date_of_birth, joining_date, monthly_salary, basic_salary, hra, special_allowance,
        staff_advance, professional_tax, tds, bank_name, bank_address, account_holder_name, account_number,
        ifsc_code, pan_card_number, aadhar_card_number, permanent_address, alternate_phone_number
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'Active',
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25
      ) RETURNING *`,
      [
        emp.employee_id, emp.name, emp.department_id, emp.job_role, emp.mobile, emp.email, emp.password,
        emp.date_of_birth, emp.joining_date, emp.monthly_salary || 0, emp.basic_salary || 0, emp.hra || 0, emp.special_allowance || 0,
        emp.staff_advance || 0, emp.professional_tax || 0, emp.tds || 0, emp.bank_name, emp.bank_address, emp.account_holder_name, emp.account_number,
        emp.ifsc_code, emp.pan_card_number, emp.aadhar_card_number, emp.permanent_address, emp.alternate_phone_number
      ]
    );

    // Remove from resigned_employees
    await pool.query('DELETE FROM resigned_employees WHERE id = $1', [id]);

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.CREATE_EMPLOYEE,
      moduleName: MODULE_NAMES.EMPLOYEE,
      description: `Restored former employee ${emp.employee_id} - ${emp.name} to active employees`,
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Employee restored to active list successfully',
      employee: restored.rows[0]
    });
  } catch (error) {
    console.error('Restore resigned employee error:', error);
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
  getResignedEmployees,
  updateResignedEmployee,
  deleteResignedEmployeePermanently,
  restoreResignedEmployee,
  getAllDepartments
};

