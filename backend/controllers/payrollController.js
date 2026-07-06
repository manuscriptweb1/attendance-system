const pool = require('../config/database');
const exceljs = require('exceljs');
const { buildMonthlyPayroll } = require('../services/attendanceReportService');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');

const mapRecordToCamelCase = (r) => ({
  id: r.id,
  employeeId: r.employee_id,
  employeeCode: r.employee_code,
  employeeName: r.employee_name || r.name, // from join
  totalDays: r.total_days,
  workingDays: r.working_days,
  presentDays: parseFloat(r.present_days || 0),
  lateDays: parseFloat(r.late_days || 0),
  absentDays: parseFloat(r.absent_days || 0),
  holidayDays: parseFloat(r.holiday_days || 0),
  blankUnmarkedDays: parseFloat(r.blank_unmarked_days || 0),
  paidDays: parseFloat(r.paid_days || 0),
  halfDays: parseFloat(r.half_days || 0),
  halfDayLossAmount: parseFloat(r.half_day_loss_amount || 0),
  monthlyEarning: parseFloat(r.monthly_earning || 0),
  perDaySalary: parseFloat(r.per_day_salary || 0),
  lopDays: parseFloat(r.lop_days || 0),
  lopAmount: parseFloat(r.lop_amount || 0),
  netEarning: parseFloat(r.net_earning || 0),
  basicSalary: parseFloat(r.basic_salary || 0),
  hra: parseFloat(r.hra || 0),
  specialAllowance: parseFloat(r.special_allowance || 0),
  staffAdvance: parseFloat(r.staff_advance || 0),
  professionalTax: parseFloat(r.professional_tax || 0),
  tds: parseFloat(r.tds || 0),
  netPayable: parseFloat(r.net_payable || 0),
  status: r.status
});

const getPayrollRecords = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year required' });
    }

    const result = await pool.query(
      `SELECT pr.*, e.name as employee_name 
       FROM payroll_records pr
       JOIN employees e ON pr.employee_id::text = e.id::text OR pr.employee_code::text = e.employee_id::text
       WHERE pr.payroll_month = $1 AND pr.payroll_year = $2
       ORDER BY e.name ASC`,
      [month, year]
    );

    if (result.rows.length > 0) {
      return res.json({ 
        success: true, 
        records: result.rows.map(mapRecordToCamelCase), 
        isCalculated: true 
      });
    }

    // Preview
    return res.json({ success: true, records: [], isCalculated: false });
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const calculatePayroll = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year required' });
    }

    const calculatedRecords = await buildMonthlyPayroll(month, year);

    for (const pr of calculatedRecords) {
      // Upsert into database
      await pool.query(
        `INSERT INTO payroll_records (
          employee_id, employee_code, payroll_month, payroll_year, 
          present_days, late_days, absent_days, blank_unmarked_days, holiday_days,
          total_days, working_days, paid_days, half_days, half_day_loss_amount,
          monthly_earning, per_day_salary, lop_days, lop_amount, net_earning,
          basic_salary, hra, special_allowance, staff_advance, professional_tax, tds, net_payable, status, is_manual_edited
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28
        )
        ON CONFLICT (employee_id, payroll_month, payroll_year) DO UPDATE SET
          present_days = EXCLUDED.present_days,
          late_days = EXCLUDED.late_days,
          absent_days = EXCLUDED.absent_days,
          blank_unmarked_days = EXCLUDED.blank_unmarked_days,
          holiday_days = EXCLUDED.holiday_days,
          total_days = EXCLUDED.total_days,
          working_days = EXCLUDED.working_days,
          paid_days = EXCLUDED.paid_days,
          half_days = EXCLUDED.half_days,
          half_day_loss_amount = EXCLUDED.half_day_loss_amount,
          monthly_earning = EXCLUDED.monthly_earning,
          per_day_salary = EXCLUDED.per_day_salary,
          lop_days = EXCLUDED.lop_days,
          lop_amount = EXCLUDED.lop_amount,
          net_earning = EXCLUDED.net_earning,
          basic_salary = EXCLUDED.basic_salary,
          hra = EXCLUDED.hra,
          special_allowance = EXCLUDED.special_allowance,
          staff_advance = EXCLUDED.staff_advance,
          professional_tax = EXCLUDED.professional_tax,
          tds = EXCLUDED.tds,
          net_payable = EXCLUDED.net_payable,
          updated_at = CURRENT_TIMESTAMP`,
        [
          pr.employeeCode, pr.employeeCode, month, year,
          pr.presentDays, pr.lateDays, pr.absentDays, pr.blankUnmarkedDays, pr.holidayDays,
          pr.totalDays, pr.workingDays, pr.paidDays, pr.halfDays, pr.halfDayLossAmount,
          pr.monthlyEarning, pr.perDaySalary, pr.lopDays, pr.lopAmount, pr.netEarning,
          pr.basicSalary, pr.hra, pr.specialAllowance, pr.staffAdvance, pr.professionalTax, pr.tds, pr.netPayable, 'pending', pr.is_manual_edited || false
        ]
      );
    }

    let totalNetPayable = 0;
    calculatedRecords.forEach(pr => {
      totalNetPayable += parseFloat(pr.netPayable) || 0;
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[parseInt(month) - 1] || month;

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.CALCULATE_ALL_PAYROLL,
      moduleName: MODULE_NAMES.PAYROLL,
      description: `Calculated payroll for ${monthName} ${year}. Total employees processed: ${calculatedRecords.length}. Total net payable: ₹${totalNetPayable.toLocaleString('en-IN')}.`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Payroll calculated successfully', records: calculatedRecords });
  } catch (error) {
    console.error('Calculate payroll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updatePayrollStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'hold', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const paidAt = status === 'paid' ? new Date() : null;
    const paidBy = status === 'paid' ? (req.user ? req.user.id : null) : null;

    const result = await pool.query(
      `UPDATE payroll_records 
       SET status = $1, paid_at = $2, paid_by = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [status, paidAt, paidBy, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    res.json({ success: true, record: mapRecordToCamelCase(result.rows[0]) });
  } catch (error) {
    console.error('Update payroll status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const exportPayroll = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year required' });
    }

    const result = await pool.query(
      `SELECT pr.*, e.name as employee_name 
       FROM payroll_records pr
       JOIN employees e ON pr.employee_id::text = e.id::text OR pr.employee_code::text = e.employee_id::text
       WHERE pr.payroll_month = $1 AND pr.payroll_year = $2
       ORDER BY e.name ASC`,
      [month, year]
    );

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Payroll');

    worksheet.columns = [
      { header: 'Employee Code', key: 'employee_code', width: 15 },
      { header: 'Employee Name', key: 'employee_name', width: 25 },
      { header: 'Total Days', key: 'total_days', width: 12 },
      { header: 'Working Days', key: 'working_days', width: 15 },
      { header: 'Paid Days', key: 'paid_days', width: 12 },
      { header: 'Half Days', key: 'half_days', width: 12 },
      { header: 'Half Day Amount', key: 'half_day_loss_amount', width: 15 },
      { header: 'Monthly Earning', key: 'monthly_earning', width: 18 },
      { header: 'Per Day Salary', key: 'per_day_salary', width: 18 },
      { header: 'LOP Days', key: 'lop_days', width: 12 },
      { header: 'LOP Amount', key: 'lop_amount', width: 15 },
      { header: 'Net Earning', key: 'net_earning', width: 15 },
      { header: 'Basic', key: 'basic_salary', width: 15 },
      { header: 'HRA', key: 'hra', width: 15 },
      { header: 'Special Allowance', key: 'special_allowance', width: 20 },
      { header: 'Staff Advance', key: 'staff_advance', width: 15 },
      { header: 'PT', key: 'professional_tax', width: 10 },
      { header: 'TDS', key: 'tds', width: 10 },
      { header: 'Net Payable', key: 'net_payable', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    worksheet.addRows(result.rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Payroll_${month}_${year}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export payroll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updatePayrollRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      monthly_earning, basic_salary, hra, special_allowance, 
      staff_advance, professional_tax, tds, status,
      work_days, paid_days, lop_days
    } = req.body;
    
    if (!['pending', 'hold', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const existing = await pool.query(`
      SELECT pr.*, e.name as employee_name
      FROM payroll_records pr
      JOIN employees e ON pr.employee_id::text = e.id::text OR pr.employee_code::text = e.employee_id::text
      WHERE pr.id = $1
    `, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const currentRecord = existing.rows[0];
    const totalDays = parseFloat(currentRecord.total_days) || 0;
    
    const newStaffAdvance = parseFloat(staff_advance) || 0;
    const newProfessionalTax = parseFloat(professional_tax) || 0;
    const newTds = parseFloat(tds) || 0;
    const newMonthlyEarning = parseFloat(monthly_earning) || 0;
    const newBasicSalary = parseFloat(basic_salary) || 0;
    const newHra = parseFloat(hra) || 0;
    const newSpecialAllowance = parseFloat(special_allowance) || 0;

    const newWorkDays = parseFloat(work_days) ?? parseFloat(currentRecord.working_days);
    const newPaidDays = parseFloat(paid_days) ?? parseFloat(currentRecord.paid_days);
    const newLopDays = parseFloat(lop_days) ?? parseFloat(currentRecord.lop_days);
    
    // Recalculate derived
    const newPerDaySalary = totalDays > 0 ? (newMonthlyEarning / totalDays) : 0;
    const newLopAmount = newLopDays * newPerDaySalary;
    const newNetEarning = newMonthlyEarning - newLopAmount;
    const newNetPayable = newNetEarning - newStaffAdvance - newProfessionalTax - newTds;
    
    const paidAt = status === 'paid' ? new Date() : null;
    const paidBy = status === 'paid' ? (req.user ? req.user.id : null) : null;

    await pool.query(
      `UPDATE payroll_records 
       SET 
        monthly_earning = $1, basic_salary = $2, hra = $3, special_allowance = $4,
        staff_advance = $5, professional_tax = $6, tds = $7, net_payable = $8,
        status = $9, paid_at = $10, paid_by = $11, updated_at = CURRENT_TIMESTAMP,
        working_days = $13, paid_days = $14, lop_days = $15, 
        per_day_salary = $16, lop_amount = $17, net_earning = $18, is_manual_edited = true
       WHERE id = $12`,
      [
        newMonthlyEarning, newBasicSalary, newHra, newSpecialAllowance, 
        newStaffAdvance, newProfessionalTax, newTds, newNetPayable,
        status, paidAt, paidBy, id,
        newWorkDays, newPaidDays, newLopDays, newPerDaySalary, newLopAmount, newNetEarning
      ]
    );

    const updated = await pool.query(
      `SELECT pr.*, e.name as employee_name 
       FROM payroll_records pr
       JOIN employees e ON pr.employee_id::text = e.id::text OR pr.employee_code::text = e.employee_id::text
       WHERE pr.id = $1`,
      [id]
    );

    const newData = updated.rows[0];
    let changes = [];
    
    if (parseFloat(currentRecord.working_days || 0) !== parseFloat(newData.working_days || 0)) {
      changes.push(`Working Days changed from ${currentRecord.working_days || 0} to ${newData.working_days || 0}`);
    }
    if (parseFloat(currentRecord.paid_days || 0) !== parseFloat(newData.paid_days || 0)) {
      changes.push(`Paid Days changed from ${currentRecord.paid_days || 0} to ${newData.paid_days || 0}`);
    }
    if (parseFloat(currentRecord.lop_days || 0) !== parseFloat(newData.lop_days || 0)) {
      changes.push(`LOP Days changed from ${currentRecord.lop_days || 0} to ${newData.lop_days || 0}`);
    }
    if (parseFloat(currentRecord.staff_advance || 0) !== parseFloat(newData.staff_advance || 0)) {
      changes.push(`Staff Advance changed from ₹${currentRecord.staff_advance || 0} to ₹${newData.staff_advance || 0}`);
    }
    if (parseFloat(currentRecord.professional_tax || 0) !== parseFloat(newData.professional_tax || 0)) {
      changes.push(`PT changed from ₹${currentRecord.professional_tax || 0} to ₹${newData.professional_tax || 0}`);
    }
    if (parseFloat(currentRecord.tds || 0) !== parseFloat(newData.tds || 0)) {
      changes.push(`TDS changed from ₹${currentRecord.tds || 0} to ₹${newData.tds || 0}`);
    }
    if (currentRecord.status !== newData.status) {
      const oldStatus = currentRecord.status ? currentRecord.status.charAt(0).toUpperCase() + currentRecord.status.slice(1) : 'Pending';
      const newStatus = newData.status ? newData.status.charAt(0).toUpperCase() + newData.status.slice(1) : 'Pending';
      changes.push(`Status changed from ${oldStatus} to ${newStatus}`);
    }

    if (changes.length > 0) {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthName = monthNames[parseInt(currentRecord.payroll_month) - 1] || currentRecord.payroll_month;
      
      await logAdminActivity({
        adminId: req.user.id,
        adminName: req.user.username,
        adminEmail: req.user.email || '',
        actionType: ADMIN_ACTION_TYPES.UPDATE_PAYROLL,
        moduleName: MODULE_NAMES.PAYROLL,
        description: `Updated payroll for ${currentRecord.employee_code} - ${currentRecord.employee_name} for ${monthName} ${currentRecord.payroll_year}. ${changes.join('; ')}.`,
        oldData: currentRecord,
        newData: newData,
        ipAddress: req.ip
      });
    }

    res.json({ success: true, record: mapRecordToCamelCase(newData) });
  } catch (error) {
    console.error('Update payroll record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const calculateSinglePayroll = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.body;
    if (!month || !year || !employeeId) {
      return res.status(400).json({ success: false, message: 'Month, year and employeeId required' });
    }

    const calculatedRecords = await buildMonthlyPayroll(month, year, employeeId);
    
    if (calculatedRecords.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found or invalid' });
    }

    const pr = calculatedRecords[0];

    const result = await pool.query(
      `INSERT INTO payroll_records (
        employee_id, employee_code, payroll_month, payroll_year, 
        present_days, late_days, absent_days, blank_unmarked_days, holiday_days,
        total_days, working_days, paid_days, half_days, half_day_loss_amount,
        monthly_earning, per_day_salary, lop_days, lop_amount, net_earning,
        basic_salary, hra, special_allowance, staff_advance, professional_tax, tds, net_payable, status, is_manual_edited
      ) VALUES (
        $1, $2, $3, $4, 
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28
      )
      ON CONFLICT (employee_id, payroll_month, payroll_year) DO UPDATE SET
        present_days = EXCLUDED.present_days,
        late_days = EXCLUDED.late_days,
        absent_days = EXCLUDED.absent_days,
        blank_unmarked_days = EXCLUDED.blank_unmarked_days,
        holiday_days = EXCLUDED.holiday_days,
        total_days = EXCLUDED.total_days,
        working_days = EXCLUDED.working_days,
        paid_days = EXCLUDED.paid_days,
        half_days = EXCLUDED.half_days,
        half_day_loss_amount = EXCLUDED.half_day_loss_amount,
        monthly_earning = EXCLUDED.monthly_earning,
        per_day_salary = EXCLUDED.per_day_salary,
        lop_days = EXCLUDED.lop_days,
        lop_amount = EXCLUDED.lop_amount,
        net_earning = EXCLUDED.net_earning,
        basic_salary = EXCLUDED.basic_salary,
        hra = EXCLUDED.hra,
        special_allowance = EXCLUDED.special_allowance,
        staff_advance = EXCLUDED.staff_advance,
        professional_tax = EXCLUDED.professional_tax,
        tds = EXCLUDED.tds,
        net_payable = EXCLUDED.net_payable,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        pr.employeeCode, pr.employeeCode, month, year,
        pr.presentDays, pr.lateDays, pr.absentDays, pr.blankUnmarkedDays, pr.holidayDays,
        pr.totalDays, pr.workingDays, pr.paidDays, pr.halfDays, pr.halfDayLossAmount,
        pr.monthlyEarning, pr.perDaySalary, pr.lopDays, pr.lopAmount, pr.netEarning,
        pr.basicSalary, pr.hra, pr.specialAllowance, pr.staffAdvance, pr.professionalTax, pr.tds, pr.netPayable, 'pending', pr.is_manual_edited || false
      ]
    );

    const updated = await pool.query(
      `SELECT pr.*, e.name as employee_name 
       FROM payroll_records pr
       JOIN employees e ON pr.employee_id::text = e.id::text OR pr.employee_code::text = e.employee_id::text
       WHERE pr.id = $1`,
      [result.rows[0].id]
    );

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[parseInt(month) - 1] || month;
    const finalRecord = updated.rows[0];

    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.CALCULATE_PAYROLL,
      moduleName: MODULE_NAMES.PAYROLL,
      description: `Calculated payroll for ${finalRecord.employee_code} - ${finalRecord.employee_name} for ${monthName} ${year}. Net payable: ₹${parseFloat(finalRecord.net_payable || 0).toLocaleString('en-IN')}.`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Payroll calculated successfully', record: mapRecordToCamelCase(finalRecord) });
  } catch (error) {
    console.error('Calculate single payroll error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getPaySlipData = async (req, res) => {
  try {
    const { employee_id, month, year } = req.query;
    if (!employee_id || !month || !year) {
      return res.status(400).json({ success: false, message: 'employee_id, month, and year are required' });
    }

    const result = await pool.query(
      `SELECT pr.*, 
              e.employee_id as emp_code_real, e.name as employee_name, e.job_role,
              d.name as department_name
       FROM payroll_records pr
       JOIN employees e ON pr.employee_id::text = e.id::text OR pr.employee_code::text = e.employee_id::text
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE (pr.employee_id::text = $1 OR pr.employee_code::text = $1)
         AND pr.payroll_month = $2 AND pr.payroll_year = $3
       LIMIT 1`,
      [employee_id, month, year]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll record not found for this month' });
    }

    const r = result.rows[0];

    const basic = parseFloat(r.basic_salary) || 0;
    const hra = parseFloat(r.hra) || 0;
    const special_allowance = parseFloat(r.special_allowance) || 0;
    const gross_earnings = basic + hra + special_allowance;

    const lop_amount = parseFloat(r.lop_amount) || 0;
    const pt = parseFloat(r.professional_tax) || 0;
    const tds = parseFloat(r.tds) || 0;
    const staff_advance = parseFloat(r.staff_advance) || 0;
    const total_deductions = lop_amount + pt + tds + staff_advance;

    const net_payable = parseFloat(r.net_payable) || (gross_earnings - total_deductions);

    // If absent_days not natively saved, derive it from total - paid (or present, depending on how they store it). 
    // The user suggested: total_days - paid_days
    let absent_days = parseFloat(r.absent_days) || 0;
    if (absent_days === 0 && r.paid_days) {
       absent_days = Math.max(0, parseFloat(r.total_days || 0) - parseFloat(r.paid_days || 0));
    }

    res.json({
      success: true,
      employee: {
        employee_code: r.emp_code_real || r.employee_code,
        name: r.employee_name,
        designation: r.job_role || '-',
        department: r.department_name || '-'
      },
      payroll: {
        month: parseInt(month),
        year: parseInt(year),
        total_days: parseFloat(r.total_days) || 0,
        work_days: parseFloat(r.working_days) || 0,
        paid_days: parseFloat(r.paid_days) || 0,
        present_days: parseFloat(r.present_days) || 0,
        absent_days: absent_days,
        basic: basic,
        hra: hra,
        special_allowance: special_allowance,
        lop_amount: lop_amount,
        pt: pt,
        tds: tds,
        staff_advance: staff_advance,
        gross_earnings: gross_earnings,
        total_deductions: total_deductions,
        net_payable: net_payable
      }
    });

  } catch (error) {
    console.error('Get Pay Slip error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Clear payroll records for a date range (clears entire months that overlap the range)
 * @route   DELETE /api/payroll/clear-range
 * @access  Private/Admin
 */
const clearPayrollRange = async (req, res) => {
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

    const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
    const adminId = req.user.id;
    const adminName = req.user.username;

    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    // Collect all month/year combinations
    let conditions = [];
    let params = [];
    let paramIndex = 1;

    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= endLimit) {
      conditions.push(`(payroll_month = $${paramIndex} AND payroll_year = $${paramIndex + 1})`);
      params.push(current.getMonth() + 1, current.getFullYear());
      paramIndex += 2;
      current.setMonth(current.getMonth() + 1);
    }

    if (conditions.length === 0) {
      return res.json({ success: true, message: 'No matching months found', deletedCount: 0 });
    }

    const deleteQuery = `DELETE FROM payroll_records WHERE ${conditions.join(' OR ')} RETURNING id`;
    const result = await pool.query(deleteQuery, params);

    // Log the action
    await logAdminActivity({
      adminId,
      adminName,
      actionType: ADMIN_ACTION_TYPES.CLEAR_RANGE,
      moduleName: MODULE_NAMES.PAYROLL,
      description: `Cleared payroll records from ${fromDate} to ${toDate}. Count: ${result.rowCount}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Payroll records cleared successfully',
      deletedCount: result.rowCount
    });

  } catch (error) {
    console.error('Clear payroll range error:', error);
    res.status(500).json({ success: false, message: 'Server error while clearing records' });
  }
};

module.exports = {
  getPayrollRecords,
  calculatePayroll,
  updatePayrollStatus,
  exportPayroll,
  updatePayrollRecord,
  calculateSinglePayroll,
  getPaySlipData,
  clearPayrollRange
};
