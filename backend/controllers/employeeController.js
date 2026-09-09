const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');
const { getCompanyLogoPath, registerPayslipFonts } = require('../utils/payslipGenerator');
const { renderEmployeeFormPage } = require('../utils/employeeFormGenerator');
const { getBrandingSettings } = require('../utils/brandingSettingsHelper');

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
      personal_email,
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

    if (personal_email && email && personal_email.trim().toLowerCase() === email.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Office email and Personal email cannot be the same. Please provide a different personal email.'
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
       (employee_id, name, department_id, job_role, mobile, email, personal_email, password, status, date_of_birth, joining_date,
       monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds,
       bank_name, bank_address, account_holder_name, account_number, ifsc_code, pan_card_number, aadhar_card_number, permanent_address, alternate_phone_number) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27) 
       RETURNING *`,
      [employee_id, name, department_id, job_role, mobile, email, personal_email || null, hashedPassword, status, date_of_birth, joining_date || null,
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
        employee_id, name, job_role, email, personal_email, mobile, department_id, date_of_birth, joining_date,
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
      personal_email,
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

    if (personal_email && email && personal_email.trim().toLowerCase() === email.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Office email and Personal email cannot be the same. Please provide a different personal email.'
      });
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
    let isResignedRecord = false;
    let checkResult = await pool.query(
      'SELECT * FROM employees WHERE id::text = $1 OR employee_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      checkResult = await pool.query(
        'SELECT * FROM resigned_employees WHERE id::text = $1 OR original_id::text = $1 OR employee_id = $1',
        [id]
      );
      if (checkResult.rows.length > 0) {
        isResignedRecord = true;
      } else {
        return res.status(404).json({ 
          success: false, 
          message: 'Employee not found' 
        });
      }
    }

    const targetTable = isResignedRecord ? 'resigned_employees' : 'employees';
    const targetId = checkResult.rows[0].id;

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
      query = `UPDATE ${targetTable} 
               SET name = $1, department_id = $2, job_role = $3, 
                   mobile = $4, email = $5, personal_email = $6, status = $7, password = $8, 
                   date_of_birth = $9, joining_date = $10, monthly_salary = $11, basic_salary = $12, hra = $13, 
                   special_allowance = $14, staff_advance = $15, professional_tax = $16, tds = $17,
                   bank_name = $18, bank_address = $19, account_holder_name = $20, account_number = $21,
                   ifsc_code = $22, pan_card_number = $23, aadhar_card_number = $24, permanent_address = $25,
                   alternate_phone_number = $26, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $27 
               RETURNING *`;
      values = [name, department_id, job_role, mobile, email, personal_email || null, status, hashedPassword, date_of_birth, joining_date || null,
                monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds,
                bank_name || null, bank_address || null, account_holder_name || null, formatted_account, formatted_ifsc, formatted_pan, formatted_aadhar, permanent_address || null, formatted_alt_phone, targetId];
    } else {
      query = `UPDATE ${targetTable} 
               SET name = $1, department_id = $2, job_role = $3, 
                   mobile = $4, email = $5, personal_email = $6, status = $7, 
                   date_of_birth = $8, joining_date = $9, monthly_salary = $10, basic_salary = $11, hra = $12, 
                   special_allowance = $13, staff_advance = $14, professional_tax = $15, tds = $16,
                   bank_name = $17, bank_address = $18, account_holder_name = $19, account_number = $20,
                   ifsc_code = $21, pan_card_number = $22, aadhar_card_number = $23, permanent_address = $24,
                   alternate_phone_number = $25, updated_at = CURRENT_TIMESTAMP 
               WHERE id = $26 
               RETURNING *`;
      values = [name, department_id, job_role, mobile, email, personal_email || null, status, date_of_birth, joining_date || null,
                monthly_salary, basic_salary, hra, special_allowance, staff_advance, professional_tax, tds,
                bank_name || null, bank_address || null, account_holder_name || null, formatted_account, formatted_ifsc, formatted_pan, formatted_aadhar, permanent_address || null, formatted_alt_phone, targetId];
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

    // Check if salary fields changed to auto-sync pending payroll months
    const salaryChanged = (
      parseFloat(oldEmp.monthly_salary || 0) !== parseFloat(monthly_salary || 0) ||
      parseFloat(oldEmp.basic_salary || 0) !== parseFloat(basic_salary || 0) ||
      parseFloat(oldEmp.hra || 0) !== parseFloat(hra || 0) ||
      parseFloat(oldEmp.special_allowance || 0) !== parseFloat(special_allowance || 0) ||
      parseFloat(oldEmp.staff_advance || 0) !== parseFloat(staff_advance || 0) ||
      parseFloat(oldEmp.professional_tax || 0) !== parseFloat(professional_tax || 0) ||
      parseFloat(oldEmp.tds || 0) !== parseFloat(tds || 0)
    );

    if (salaryChanged) {
      try {
        const pendingRecordsRes = await pool.query(
          `SELECT * FROM payroll_records 
           WHERE (employee_id::text = $1 OR employee_code::text = $2 OR employee_id::text = $2)
             AND status = 'pending'`,
          [String(id), String(oldEmp.employee_id)]
        );

        for (const pr of pendingRecordsRes.rows) {
          const totalDays = parseFloat(pr.total_days) || 0;
          const lopDays = parseFloat(pr.lop_days) || 0;
          const halfDays = parseFloat(pr.half_days) || 0;
          const loanDeduction = parseFloat(pr.loan_deduction) || 0;
          
          const newMonthly = parseFloat(monthly_salary) || 0;
          const newBasic = parseFloat(basic_salary) || Number((newMonthly * 0.50).toFixed(2));
          const newHra = parseFloat(hra) || Number((newMonthly * 0.20).toFixed(2));
          const newSpecial = parseFloat(special_allowance) || Number((newMonthly - newBasic - newHra).toFixed(2));
          const newStaffAdv = parseFloat(staff_advance) || 0;
          const newPt = parseFloat(professional_tax) || 0;
          const newTds = parseFloat(tds) || 0;

          const newPerDaySalary = totalDays > 0 ? (newMonthly / totalDays) : 0;
          const newHalfDayLoss = halfDays * 0.5 * newPerDaySalary;
          const newLopAmount = lopDays * newPerDaySalary;
          const newNetEarning = newMonthly - newLopAmount;
          const newSalaryBeforeLoan = Math.max(0, newNetEarning - newStaffAdv - newPt - newTds);
          const newNetPayable = Math.max(0, newSalaryBeforeLoan - loanDeduction);

          await pool.query(
            `UPDATE payroll_records SET
              monthly_earning = $1,
              basic_salary = $2,
              hra = $3,
              special_allowance = $4,
              staff_advance = $5,
              professional_tax = $6,
              tds = $7,
              per_day_salary = $8,
              half_day_loss_amount = $9,
              lop_amount = $10,
              net_earning = $11,
              net_payable = $12,
              updated_at = CURRENT_TIMESTAMP
             WHERE id = $13`,
            [
              newMonthly, newBasic, newHra, newSpecial,
              newStaffAdv, newPt, newTds,
              newPerDaySalary, newHalfDayLoss, newLopAmount,
              newNetEarning, newNetPayable, pr.id
            ]
          );
        }
      } catch (payrollSyncErr) {
        console.warn('Could not auto-sync pending payroll records on employee salary update:', payrollSyncErr.message);
      }
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
        original_id, employee_id, name, department_id, job_role, mobile, email, personal_email, password, status,
        date_of_birth, joining_date, resigned_date, monthly_salary, basic_salary, hra, special_allowance,
        staff_advance, professional_tax, tds, bank_name, bank_address, account_holder_name, account_number,
        ifsc_code, pan_card_number, aadhar_card_number, permanent_address, alternate_phone_number, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'Resigned',
        $10, $11, CURRENT_DATE, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28
      )`,
      [
        emp.id, emp.employee_id, emp.name, emp.department_id, emp.job_role, emp.mobile, emp.email, emp.personal_email || null, emp.password,
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
        employee_id, name, department_id, job_role, mobile, email, personal_email, password, status,
        date_of_birth, joining_date, monthly_salary, basic_salary, hra, special_allowance,
        staff_advance, professional_tax, tds, bank_name, bank_address, account_holder_name, account_number,
        ifsc_code, pan_card_number, aadhar_card_number, permanent_address, alternate_phone_number
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'Active',
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        emp.employee_id, emp.name, emp.department_id, emp.job_role, emp.mobile, emp.email, emp.personal_email || null, emp.password,
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

// Download employee details form PDF
const downloadEmployeeDetailsForm = async (req, res) => {
  try {
    const { id } = req.params;

    // Search active employees first
    let result = await pool.query(
      `SELECT e.*, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id::text = $1 OR e.employee_id = $1`,
      [id]
    );

    // If not found in active, search resigned_employees
    if (result.rows.length === 0) {
      result = await pool.query(
        `SELECT r.*, d.name as department_name
         FROM resigned_employees r
         LEFT JOIN departments d ON r.department_id = d.id
         WHERE r.id::text = $1 OR r.employee_id = $1 OR r.original_id::text = $1`,
        [id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const employee = result.rows[0];
    const branding = await getBrandingSettings();
    const logoPath = branding.physical_logo_path || getCompanyLogoPath();
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const fonts = registerPayslipFonts(doc);

    const empId = employee.employee_id || 'employee';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=employee_details_${empId}.pdf`);

    doc.pipe(res);

    const generatedDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    renderEmployeeFormPage(doc, employee, generatedDateStr, logoPath, fonts, { branding });

    doc.end();
  } catch (error) {
    console.error('Download employee details form error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate employee details form PDF'
      });
    }
  }
};

function calculateTenure(startDateStr, endDateStr) {
  if (!startDateStr) return { years: 0, months: 0, days: 0, totalDays: 0, formatted: 'Not Specified' };
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(start.getTime())) return { years: 0, months: 0, days: 0, totalDays: 0, formatted: '-' };

  const diffTime = end.getTime() - start.getTime();
  const totalDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) {
    years = 0;
    months = 0;
    days = totalDays;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);

  return {
    years,
    months,
    days,
    totalDays,
    formatted: parts.join(', ')
  };
}

function calculateProbationMilestone(joiningDateStr, monthsCount = 3) {
  if (!joiningDateStr) return { date: null, is_completed: false };
  let year, month, day;
  if (typeof joiningDateStr === 'string') {
    const clean = joiningDateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    }
  }
  if (!year && joiningDateStr instanceof Date) {
    year = joiningDateStr.getFullYear();
    month = joiningDateStr.getMonth();
    day = joiningDateStr.getDate();
  }
  if (!year) {
    const d = new Date(joiningDateStr);
    if (isNaN(d.getTime())) return { date: null, is_completed: false };
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  }

  const targetDate = new Date(year, month + monthsCount, day);
  const now = new Date();
  
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;

  return {
    date: dateStr,
    is_completed: nowMidnight >= targetMidnight
  };
}

const getEmployeeFullProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch employee with department and permissions
    let empRes = await pool.query(
      `SELECT e.*, d.name as department_name,
              w.is_enabled as wfh_enabled,
              ec.is_enabled as early_checkout_enabled
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN wfh_permissions w ON e.employee_id = w.employee_id
       LEFT JOIN early_checkout_permissions ec ON e.employee_id = ec.employee_id
       WHERE e.id::text = $1 OR e.employee_id = $1`,
      [id]
    );

    if (empRes.rows.length === 0) {
      empRes = await pool.query(
        `SELECT r.*, d.name as department_name,
                false as wfh_enabled,
                false as early_checkout_enabled
         FROM resigned_employees r
         LEFT JOIN departments d ON r.department_id = d.id
         WHERE r.id::text = $1 OR r.employee_id = $1 OR r.original_id::text = $1`,
        [id]
      );
    }

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = empRes.rows[0];
    const empCode = employee.employee_id;

    // Fetch letters: offer_letters, experience_letters, relieving_letters
    const [offersRes, expRes, relRes] = await Promise.all([
      pool.query(
        `SELECT id, offer_number, status, offer_date, joining_date, acceptance_deadline_date, monthly_salary, total_ctc, generated_at, created_at
         FROM offer_letters
         WHERE employee_id = $1 OR employee_id_snapshot = $1
         ORDER BY created_at DESC LIMIT 5`,
        [empCode]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, letter_number, status, issue_date, joining_date, relieving_date, generated_at, created_at
         FROM experience_letters
         WHERE employee_id = $1 OR employee_id_snapshot = $1
         ORDER BY created_at DESC LIMIT 5`,
        [empCode]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT id, letter_number, status, issue_date, joining_date, relieving_date, notice_period, generated_at, created_at
         FROM relieving_letters
         WHERE employee_id = $1 OR employee_id_snapshot = $1
         ORDER BY created_at DESC LIMIT 5`,
        [empCode]
      ).catch(() => ({ rows: [] }))
    ]);

    // Calculate tenure
    const isResigned = employee.status?.toLowerCase() === 'inactive' || !!employee.resigned_date;
    const endDate = isResigned && employee.resigned_date ? employee.resigned_date : null;
    const tenure = calculateTenure(employee.joining_date, endDate);

    // Latest letter instances
    const latestOffer = offersRes.rows[0] || null;
    const latestExperience = expRes.rows[0] || null;
    const latestRelieving = relRes.rows[0] || null;

    // Milestones definition
    const milestones = {
      offer_letter: {
        date: latestOffer?.offer_date || employee.manual_offer_letter_date || null,
        id: latestOffer?.id || null,
        letter_number: latestOffer?.offer_number || null,
        status: latestOffer?.status || (employee.manual_offer_letter_date ? 'Manual Entry' : 'Date Not Mentioned'),
        is_system: !!latestOffer,
        is_manual: !latestOffer && !!employee.manual_offer_letter_date
      },
      joining: {
        date: employee.joining_date || null,
        status: employee.joining_date ? 'Completed' : 'Not Mentioned'
      },
      probation: calculateProbationMilestone(employee.joining_date, 3),
      current_service: {
        status: employee.status || (isResigned ? 'Resigned' : 'Active'),
        is_resigned: isResigned,
        resigned_date: employee.resigned_date || null,
        tenure: tenure
      },
      relieving_letter: {
        date: latestRelieving?.issue_date || latestRelieving?.relieving_date || null,
        id: latestRelieving?.id || null,
        letter_number: latestRelieving?.letter_number || null,
        status: latestRelieving?.status || 'Not Issued'
      },
      experience_letter: {
        date: latestExperience?.issue_date || null,
        id: latestExperience?.id || null,
        letter_number: latestExperience?.letter_number || null,
        status: latestExperience?.status || 'Not Issued'
      },
      custom: employee.milestones_override || {}
    };

    // Lifetime Attendance Summary
    const attStatsRes = await pool.query(
      `SELECT 
         COUNT(*)::int as total_days_recorded,
         COUNT(*) FILTER (WHERE attendance_status IN ('Present', 'On Time', 'Late Check-in', 'Early Checkout'))::int as present_count,
         COUNT(*) FILTER (WHERE attendance_status = 'Late Check-in' OR late_minutes > 0)::int as late_count,
         COUNT(*) FILTER (WHERE attendance_status = 'Half Day')::int as half_day_count,
         COUNT(*) FILTER (WHERE attendance_status = 'Absent')::int as absent_count,
         COUNT(*) FILTER (WHERE is_wfh = true)::int as wfh_count,
         COALESCE(ROUND(SUM(total_working_hours)::numeric, 1), 0) as total_working_hours
       FROM attendance
       WHERE employee_id = $1`,
      [empCode]
    ).catch(() => ({ rows: [{}] }));

    // Permissions & Leaves counters
    const [permCountRes, leaveCountRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as count FROM permissions WHERE employee_id = $1`, [empCode]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*)::int as count FROM absent_reasons WHERE employee_id = $1`, [empCode]).catch(() => ({ rows: [{ count: 0 }] }))
    ]);

    // Recent Payroll Records (up to 12)
    const payrollRes = await pool.query(
      `SELECT id, payroll_month, payroll_year, 
              monthly_earning as gross_salary, 
              (COALESCE(lop_amount, 0) + COALESCE(loan_deduction, 0)) as total_deductions, 
              net_payable as net_salary, 
              status, paid_at
       FROM payroll_records
       WHERE employee_id::text = $1 OR employee_code::text = $2 OR employee_code::text = $1
       ORDER BY payroll_year DESC, payroll_month DESC
       LIMIT 12`,
      [String(employee.id), empCode]
    ).catch(() => ({ rows: [] }));

    res.json({
      success: true,
      employee,
      milestones,
      tenure,
      letters: {
        offer_letters: offersRes.rows,
        experience_letters: expRes.rows,
        relieving_letters: relRes.rows
      },
      stats: {
        attendance: attStatsRes.rows[0] || {},
        total_permissions: permCountRes.rows[0]?.count || 0,
        total_leaves: leaveCountRes.rows[0]?.count || 0,
        recent_payrolls: payrollRes.rows
      }
    });

  } catch (error) {
    console.error('Get employee full profile error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving employee profile' });
  }
};

const updateEmployeeMilestones = async (req, res) => {
  try {
    const { id } = req.params;
    const { manual_offer_letter_date, joining_date, resigned_date, custom_milestones } = req.body;

    let isResigned = false;
    let current;

    const empCheck = await pool.query(
      `SELECT id, employee_id, name, manual_offer_letter_date, joining_date, resigned_date, milestones_override
       FROM employees
       WHERE id::text = $1 OR employee_id = $1`,
      [id]
    );

    if (empCheck.rows.length > 0) {
      current = empCheck.rows[0];
    } else {
      const resCheck = await pool.query(
        `SELECT id, employee_id, name, manual_offer_letter_date, joining_date, resigned_date, milestones_override
         FROM resigned_employees
         WHERE id::text = $1 OR employee_id = $1 OR original_id::text = $1`,
        [id]
      );
      if (resCheck.rows.length > 0) {
        current = resCheck.rows[0];
        isResigned = true;
      } else {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }
    }

    const newOfferDate = manual_offer_letter_date !== undefined ? (manual_offer_letter_date || null) : current.manual_offer_letter_date;
    const newJoiningDate = joining_date !== undefined ? (joining_date || null) : current.joining_date;
    const newResignedDate = resigned_date !== undefined ? (resigned_date || null) : current.resigned_date;
    
    let newMilestonesOverride = current.milestones_override || {};
    if (custom_milestones && typeof custom_milestones === 'object') {
      newMilestonesOverride = { ...newMilestonesOverride, ...custom_milestones };
    }

    let updatedRes;
    if (isResigned) {
      updatedRes = await pool.query(
        `UPDATE resigned_employees
         SET manual_offer_letter_date = $1,
             joining_date = $2,
             resigned_date = $3,
             milestones_override = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [newOfferDate, newJoiningDate, newResignedDate, JSON.stringify(newMilestonesOverride), current.id]
      );
    } else {
      updatedRes = await pool.query(
        `UPDATE employees
         SET manual_offer_letter_date = $1,
             joining_date = $2,
             resigned_date = $3,
             milestones_override = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [newOfferDate, newJoiningDate, newResignedDate, JSON.stringify(newMilestonesOverride), current.id]
      );
    }

    await logAdminActivity({
      adminId: req.user?.id,
      adminName: req.user?.username || req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_EMPLOYEE || 'Update Employee',
      moduleName: MODULE_NAMES.EMPLOYEES || 'Employees',
      description: `Updated career milestones for employee ${current.name} (${current.employee_id}).`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      success: true,
      message: 'Employee milestones updated successfully',
      employee: updatedRes.rows[0]
    });

  } catch (error) {
    console.error('Update employee milestones error:', error);
    res.status(500).json({ success: false, message: 'Server error updating milestones' });
  }
};

const getEmployeeAttendanceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year, status } = req.query;

    const empRes = await pool.query(
      `SELECT id, employee_id, joining_date, NULL::date AS resigned_date FROM employees 
       WHERE id::text = $1 OR employee_id = $1 OR LOWER(employee_id) = LOWER($1) OR TRIM(employee_id) = TRIM($1)
       UNION
       SELECT id, employee_id, joining_date, resigned_date FROM resigned_employees 
       WHERE id::text = $1 OR employee_id = $1 OR original_id::text = $1 OR LOWER(employee_id) = LOWER($1) OR TRIM(employee_id) = TRIM($1)
       LIMIT 1`,
      [id]
    );

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const empCode = empRes.rows[0].employee_id;
    const empNumericId = empRes.rows[0].id ? String(empRes.rows[0].id) : null;

    let query = `
      SELECT 
        a.*,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS formatted_attendance_date,
        CASE WHEN a.login_time IS NOT NULL THEN TO_CHAR(a.login_time, 'HH12:MI AM') ELSE NULL END AS formatted_check_in_time,
        CASE WHEN a.logout_time IS NOT NULL THEN TO_CHAR(a.logout_time, 'HH12:MI AM') ELSE NULL END AS formatted_check_out_time
      FROM attendance a
      WHERE (a.employee_id = $1 OR a.employee_id = $2 OR a.employee_id = $3)
    `;
    const params = [empCode, empNumericId || empCode, id];
    let paramIndex = 4;

    if (year && year !== 'all') {
      query += ` AND (EXTRACT(YEAR FROM a.attendance_date::DATE) = $${paramIndex} OR a.attendance_date::text LIKE $${paramIndex + 1})`;
      params.push(parseInt(year), `${year}-%`);
      paramIndex += 2;
    }

    if (month && month !== 'all') {
      const padM = String(month).padStart(2, '0');
      query += ` AND (EXTRACT(MONTH FROM a.attendance_date::DATE) = $${paramIndex} OR a.attendance_date::text LIKE $${paramIndex + 1})`;
      params.push(parseInt(month), `%-${padM}-%`);
      paramIndex += 2;
    }

    if (status && status !== 'all' && (!month || month === 'all' || !year || year === 'all')) {
      const s = status.trim().toLowerCase();
      if (s === 'late' || s === 'late check-in' || s === 'late arrivals') {
        query += ` AND (a.attendance_status = 'Late' OR a.attendance_status = 'Late Check-in' OR (a.late_minutes IS NOT NULL AND a.late_minutes > 0))`;
      } else if (s === 'absent') {
        query += ` AND (a.attendance_status = 'Absent' OR a.attendance_status = 'Not Mention')`;
      } else if (s === 'half day') {
        query += ` AND a.attendance_status = 'Half Day'`;
      } else if (s === 'work from home' || s === 'wfh') {
        query += ` AND (a.attendance_status = 'Work From Home' OR a.attendance_status = 'WFH' OR a.is_wfh = true)`;
      } else if (s === 'present') {
        query += ` AND (a.attendance_status = 'Present' OR a.attendance_status = 'On Time')`;
      } else if (s === 'holiday') {
        query += ` AND (a.attendance_status = 'Holiday' OR a.attendance_status = 'Office Holiday' OR a.attendance_status = 'Government Holiday')`;
      } else if (s === 'sunday') {
        query += ` AND a.attendance_status = 'Sunday'`;
      } else {
        query += ` AND a.attendance_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
    }

    query += ` ORDER BY a.attendance_date DESC`;

    const result = await pool.query(query, params);
    const records = result.rows.map(r => ({
      ...r,
      attendance_date: r.formatted_attendance_date || r.attendance_date,
      check_in_time: r.formatted_check_in_time || (r.check_in_time ? String(r.check_in_time) : (r.login_time ? new Date(r.login_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null)),
      check_out_time: r.formatted_check_out_time || (r.check_out_time ? String(r.check_out_time) : (r.logout_time ? new Date(r.logout_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null)),
      total_working_hours: r.total_working_hours ?? r.total_hours ?? 0,
      late_minutes: r.late_minutes || 0,
      early_minutes: r.early_minutes || 0,
      is_wfh: Boolean(r.is_wfh),
      is_auto_checkout: Boolean(r.is_auto_checkout),
      is_manual_entry: Boolean(r.is_manual_entry)
    }));

    // If an explicit month and year are selected, build the complete month calendar
    let finalRecords = records;

    if (month && month !== 'all' && year && year !== 'all') {
      const mInt = parseInt(month, 10);
      const yInt = parseInt(year, 10);
      const daysInMonth = new Date(yInt, mInt, 0).getDate();

      // Fetch holidays for the selected month and year
      const holidaysRes = await pool.query(
        `SELECT TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date_str, holiday_date, holiday_title, holiday_type FROM holidays 
         WHERE EXTRACT(MONTH FROM holiday_date) = $1 AND EXTRACT(YEAR FROM holiday_date) = $2 AND is_enabled = true`,
        [mInt, yInt]
      ).catch(() => ({ rows: [] }));

      const holidayMap = {};
      holidaysRes.rows.forEach(h => {
        const dStr = h.holiday_date_str || (h.holiday_date instanceof Date ? h.holiday_date.toISOString().split('T')[0] : String(h.holiday_date).split('T')[0]);
        holidayMap[dStr] = h;
      });

      // Employee joining & resigned dates
      const joiningDateStr = empRes.rows[0].joining_date
        ? (empRes.rows[0].joining_date instanceof Date ? empRes.rows[0].joining_date.toISOString().split('T')[0] : String(empRes.rows[0].joining_date).split('T')[0])
        : null;
      const resignedDateStr = empRes.rows[0].resigned_date
        ? (empRes.rows[0].resigned_date instanceof Date ? empRes.rows[0].resigned_date.toISOString().split('T')[0] : String(empRes.rows[0].resigned_date).split('T')[0])
        : null;

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Map existing records by YYYY-MM-DD
      const existingMap = {};
      records.forEach(r => {
        const dKey = String(r.attendance_date).split('T')[0];
        existingMap[dKey] = r;
      });

      const fullMonth = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const mStr = String(mInt).padStart(2, '0');
        const dateStr = `${yInt}-${mStr}-${dayStr}`;
        const dateObj = new Date(yInt, mInt - 1, d);
        const isSunday = dateObj.getDay() === 0;
        const holiday = holidayMap[dateStr];
        const existing = existingMap[dateStr];

        const hasWorked = Boolean(
          existing && (
            existing.login_time || 
            existing.check_in_time || 
            (existing.total_working_hours && Number(existing.total_working_hours) > 0)
          )
        );

        if (existing && hasWorked) {
          // Employee actively worked on this day! Keep their attendance record
          fullMonth.push(existing);
        } else if (holiday) {
          // Declared holiday (and employee did not punch in) -> show as Holiday
          fullMonth.push({
            ...(existing || {}),
            id: existing ? existing.id : `hol-${dateStr}`,
            employee_id: empCode,
            attendance_date: dateStr,
            login_time: null,
            logout_time: null,
            check_in_time: null,
            check_out_time: null,
            total_working_hours: 0,
            attendance_status: holiday.holiday_type || 'Holiday',
            remarks: holiday.holiday_title || 'Public Holiday',
            is_synthetic: !existing
          });
        } else if (isSunday) {
          // Sunday / Weekly Off (and employee did not punch in) -> show as Sunday
          fullMonth.push({
            ...(existing || {}),
            id: existing ? existing.id : `sun-${dateStr}`,
            employee_id: empCode,
            attendance_date: dateStr,
            login_time: null,
            logout_time: null,
            check_in_time: null,
            check_out_time: null,
            total_working_hours: 0,
            attendance_status: 'Sunday',
            remarks: 'Weekly Off',
            is_synthetic: !existing
          });
        } else if (existing) {
          // Normal active workday with an existing record in DB
          fullMonth.push(existing);
        } else if (joiningDateStr && dateStr < joiningDateStr) {
          fullMonth.push({
            id: `pre-${dateStr}`,
            employee_id: empCode,
            attendance_date: dateStr,
            login_time: null,
            logout_time: null,
            check_in_time: null,
            check_out_time: null,
            total_working_hours: 0,
            attendance_status: 'Pre-Joining',
            remarks: 'Before Joining',
            is_synthetic: true
          });
        } else if (resignedDateStr && dateStr > resignedDateStr) {
          fullMonth.push({
            id: `post-${dateStr}`,
            employee_id: empCode,
            attendance_date: dateStr,
            login_time: null,
            logout_time: null,
            check_in_time: null,
            check_out_time: null,
            total_working_hours: 0,
            attendance_status: 'Post-Exit',
            remarks: 'After Resignation',
            is_synthetic: true
          });
        } else if (dateStr > todayStr) {
          fullMonth.push({
            id: `up-${dateStr}`,
            employee_id: empCode,
            attendance_date: dateStr,
            login_time: null,
            logout_time: null,
            check_in_time: null,
            check_out_time: null,
            total_working_hours: 0,
            attendance_status: 'Upcoming',
            remarks: '—',
            is_synthetic: true
          });
        } else {
          // Past active workday with no punch in -> Not Mention (Absent)
          fullMonth.push({
            id: `abs-${dateStr}`,
            employee_id: empCode,
            attendance_date: dateStr,
            login_time: null,
            logout_time: null,
            check_in_time: null,
            check_out_time: null,
            total_working_hours: 0,
            attendance_status: 'Not Mention',
            remarks: '—',
            is_synthetic: true
          });
        }
      }

      // Filter by status if requested
      if (status && status !== 'all') {
        const s = status.trim().toLowerCase();
        finalRecords = fullMonth.filter(r => {
          const st = (r.attendance_status || '').trim().toLowerCase();
          if (s === 'present') return st === 'present' || st === 'on time';
          if (s === 'late' || s === 'late check-in' || s === 'late arrivals') {
            return st === 'late' || st === 'late check-in' || (r.late_minutes && Number(r.late_minutes) > 0);
          }
          if (s === 'half day') return st === 'half day';
          if (s === 'absent') return st === 'absent' || st === 'not mention';
          if (s === 'work from home' || s === 'wfh') return st === 'work from home' || st === 'wfh' || r.is_wfh;
          if (s === 'holiday') return st === 'holiday' || st === 'office holiday' || st === 'government holiday';
          if (s === 'sunday') return st === 'sunday';
          return st === s;
        });
      } else {
        finalRecords = fullMonth;
      }
    }

    // Compute period statistics strictly according to each status category
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let wfhDays = 0;
    let totalWorkingHours = 0;
    let totalLateMinutes = 0;

    for (const r of finalRecords) {
      const st = (r.attendance_status || '').trim();

      // 1. Present: ONLY records with Present status (or On Time)
      if (st === 'Present' || st === 'On Time') {
        presentDays++;
      } 
      // 2. Half Day: ONLY Half Day
      else if (st === 'Half Day') {
        halfDays++;
      } 
      // 3. Absent: Absent or unexcused / Not Mention (exclude Sunday, Holiday, Pre-joining, Upcoming)
      else if (st === 'Absent' || st === 'Not Mention') {
        absentDays++;
      }

      // 4. Late: Late status, Late Check-in, or late_minutes > 0
      if (st === 'Late' || st === 'Late Check-in' || (r.late_minutes && Number(r.late_minutes) > 0)) {
        lateDays++;
        totalLateMinutes += Number(r.late_minutes || 0);
      }

      // 5. Work From Home
      if (r.is_wfh || st === 'Work From Home' || st === 'WFH') {
        wfhDays++;
      }

      // 6. Total working hours logged in that period
      const hrs = Number(r.total_working_hours ?? r.total_hours ?? 0);
      if (hrs > 0) {
        totalWorkingHours += hrs;
      }
    }

    const totalDaysRecorded = finalRecords.length;
    const avgWorkingHours = totalDaysRecorded > 0 ? Number((totalWorkingHours / totalDaysRecorded).toFixed(1)) : 0;
    
    // Percentage rate calculation: Present %, Half Day %, Absent % summing to 100% of countable days
    const countableDays = presentDays + halfDays + absentDays;
    const presentRate = countableDays > 0 ? Math.round((presentDays / countableDays) * 100) : 0;
    const halfDayRate = countableDays > 0 ? Math.round((halfDays / countableDays) * 100) : 0;
    const absentRate = countableDays > 0 ? Math.round((absentDays / countableDays) * 100) : 0;

    res.json({
      success: true,
      attendance: finalRecords,
      stats: {
        totalDaysRecorded,
        presentDays,
        lateDays,
        halfDays,
        absentDays,
        wfhDays,
        totalWorkingHours: Number(totalWorkingHours.toFixed(1)),
        avgWorkingHours,
        totalLateMinutes,
        countableDays,
        presentRate,
        halfDayRate,
        absentRate,
        attendanceRate: presentRate
      }
    });

  } catch (error) {
    console.error('Get employee attendance history error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving attendance history' });
  }
};

const getEmployeePermissionsAndLeaves = async (req, res) => {
  try {
    const { id } = req.params;

    const empRes = await pool.query(
      `SELECT id, employee_id FROM employees 
       WHERE id::text = $1 OR employee_id = $1 OR LOWER(employee_id) = LOWER($1) OR TRIM(employee_id) = TRIM($1)
       UNION
       SELECT id, employee_id FROM resigned_employees 
       WHERE id::text = $1 OR employee_id = $1 OR original_id::text = $1 OR LOWER(employee_id) = LOWER($1) OR TRIM(employee_id) = TRIM($1)
       LIMIT 1`,
      [id]
    );

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const empCode = empRes.rows[0].employee_id;
    const empNumericId = empRes.rows[0].id ? String(empRes.rows[0].id) : null;

    const [permRes, absentRes] = await Promise.all([
      pool.query(
        `SELECT 
           id,
           employee_id,
           TO_CHAR(permission_date, 'YYYY-MM-DD') AS permission_date,
           TO_CHAR(from_time, 'HH12:MI AM') AS from_time_formatted,
           TO_CHAR(to_time, 'HH12:MI AM') AS to_time_formatted,
           from_time,
           to_time,
           duration_minutes,
           reason,
           created_at
         FROM employee_permissions
         WHERE (employee_id = $1 OR employee_id = $2 OR employee_id = $3)
         ORDER BY permission_date DESC, from_time DESC`,
        [empCode, empNumericId || empCode, id]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT 
           id,
           employee_id,
           TO_CHAR(attendance_date, 'YYYY-MM-DD') AS attendance_date,
           attendance_status,
           absent_reason,
           updated_at
         FROM attendance
         WHERE (employee_id = $1 OR employee_id = $2 OR employee_id = $3) AND absent_reason IS NOT NULL AND TRIM(absent_reason) != ''
         ORDER BY attendance_date DESC`,
        [empCode, empNumericId || empCode, id]
      ).catch(() => ({ rows: [] }))
    ]);

    const permissions = permRes.rows;
    const absentRecords = absentRes.rows;
    const totalMinutes = permissions.reduce((acc, p) => acc + Number(p.duration_minutes || 0), 0);

    res.json({
      success: true,
      permissions,
      absentRecords,
      summary: {
        totalPermissions: permissions.length,
        totalPermissionMinutes: totalMinutes,
        totalLeavesWithReason: absentRecords.length
      }
    });

  } catch (error) {
    console.error('Get employee permissions and leaves error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving permissions and leaves' });
  }
};

const getEmployeePayrollHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Resolve employee from active or resigned employees
    let empRes = await pool.query(
      `SELECT e.*, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id::text = $1 OR e.employee_id = $1 OR LOWER(e.employee_id) = LOWER($1) OR TRIM(e.employee_id) = TRIM($1)
       LIMIT 1`,
      [id]
    );

    if (empRes.rows.length === 0) {
      empRes = await pool.query(
        `SELECT r.*, d.name as department_name
         FROM resigned_employees r
         LEFT JOIN departments d ON r.department_id = d.id
         WHERE r.id::text = $1 OR r.employee_id = $1 OR r.original_id::text = $1 OR LOWER(r.employee_id) = LOWER($1) OR TRIM(r.employee_id) = TRIM($1)
         LIMIT 1`,
        [id]
      );
    }

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = empRes.rows[0];
    const empCode = employee.employee_id;
    const empNumericId = employee.id;

    // Fetch payroll records and employee loans in parallel
    const [payrollRes, loansRes] = await Promise.all([
      pool.query(
        `SELECT 
           pr.*,
           COALESCE(e.name, r.name, pr.employee_id) as employee_name,
           COALESCE(de.name, dr.name) as department_name
         FROM payroll_records pr
         LEFT JOIN employees e ON pr.employee_id::text = e.id::text OR pr.employee_code::text = e.employee_id::text
         LEFT JOIN departments de ON e.department_id = de.id
         LEFT JOIN resigned_employees r ON pr.employee_id::text = r.employee_id::text OR pr.employee_code::text = r.employee_id::text
         LEFT JOIN departments dr ON r.department_id = dr.id
         WHERE (pr.employee_id::text = $1 OR pr.employee_code::text = $1 OR e.employee_id::text = $1 OR e.id::text = $1 OR r.employee_id::text = $1)
         ORDER BY pr.payroll_year DESC, pr.payroll_month DESC`,
        [empCode]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT 
           id, loan_code, employee_id, employee_code,
           (total_loan_amount_paise / 100.0) AS total_loan_amount,
           repayment_months,
           (monthly_scheduled_deduction_paise / 100.0) AS monthly_deduction,
           (total_posted_deduction_paise / 100.0) AS total_posted_deduction,
           (remaining_balance_paise / 100.0) AS remaining_balance,
           loan_issue_date,
           first_deduction_month,
           first_deduction_year,
           expected_completion_month,
           expected_completion_year,
           completed_instalments,
           remaining_planned_instalments,
           status,
           calculation_mode,
           remarks,
           created_at
         FROM employee_loans
         WHERE employee_code = $1 OR employee_id::text = $2
         ORDER BY created_at DESC`,
        [empCode, String(empNumericId)]
      ).catch(() => ({ rows: [] }))
    ]);

    const records = payrollRes.rows;
    const loans = loansRes.rows;

    // Derived summary calculations
    let totalGrossEarned = 0;
    let totalNetPaid = 0;
    let totalDeductions = 0;
    let paidSlipsCount = 0;

    for (const r of records) {
      const monthlyEarn = parseFloat(r.monthly_earning || 0);
      const netPay = parseFloat(r.net_payable || 0);
      const adv = parseFloat(r.staff_advance || 0);
      const pt = parseFloat(r.professional_tax || 0);
      const tds = parseFloat(r.tds || 0);
      const lop = parseFloat(r.lop_amount || 0);

      totalGrossEarned += monthlyEarn;
      totalDeductions += (adv + pt + tds + lop);

      if (r.status === 'paid') {
        totalNetPaid += netPay;
        paidSlipsCount++;
      }
    }

    // Salary structure
    const monthlySalary = parseFloat(employee.monthly_salary || 0);
    const basicSalary = parseFloat(employee.basic_salary || 0) || Number((monthlySalary * 0.50).toFixed(2));
    const hra = parseFloat(employee.hra || 0) || Number((monthlySalary * 0.20).toFixed(2));
    const specialAllowance = parseFloat(employee.special_allowance || 0) || Math.max(0, Number((monthlySalary - basicSalary - hra).toFixed(2)));
    const professionalTax = parseFloat(employee.professional_tax || 0);
    const tds = parseFloat(employee.tds || 0);
    const staffAdvance = parseFloat(employee.staff_advance || 0);
    const estimatedNet = Math.max(0, Number((monthlySalary - professionalTax - tds - staffAdvance).toFixed(2)));

    const salaryStructure = {
      monthlySalary,
      annualCtc: monthlySalary * 12,
      basicSalary,
      hra,
      specialAllowance,
      professionalTax,
      tds,
      staffAdvance,
      estimatedNet,
      bankDetails: {
        bankName: employee.bank_name || null,
        bankAddress: employee.bank_address || null,
        accountHolderName: employee.account_holder_name || null,
        accountNumber: employee.account_number || null,
        ifscCode: employee.ifsc_code || null,
        panNumber: employee.pan_card_number || null,
        aadharNumber: employee.aadhar_card_number || null
      }
    };

    res.json({
      success: true,
      records,
      loans,
      salaryStructure,
      summary: {
        totalSlips: records.length,
        paidSlipsCount,
        totalGrossEarned: Number(totalGrossEarned.toFixed(2)),
        totalNetPaid: Number(totalNetPaid.toFixed(2)),
        totalDeductions: Number(totalDeductions.toFixed(2)),
        activeLoansCount: loans.filter(l => l.status === 'Active' || l.status === 'Scheduled').length,
        totalOutstandingLoan: Number(loans.filter(l => l.status === 'Active' || l.status === 'Scheduled').reduce((acc, l) => acc + Number(l.remaining_balance || 0), 0).toFixed(2))
      }
    });

  } catch (error) {
    console.error('Get employee payroll history error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving payroll history' });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  getEmployeeFullProfile,
  updateEmployeeMilestones,
  getEmployeeAttendanceHistory,
  getEmployeePermissionsAndLeaves,
  getEmployeePayrollHistory,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getResignedEmployees,
  updateResignedEmployee,
  deleteResignedEmployeePermanently,
  restoreResignedEmployee,
  getAllDepartments,
  downloadEmployeeDetailsForm
};


