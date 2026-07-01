const pool = require('../config/database');
const exceljs = require('exceljs');
const { buildMonthlyPayroll } = require('../services/attendanceReportService');

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
          total_days, working_days, paid_days, half_days, 
          monthly_earning, per_day_salary, lop_days, lop_amount, net_earning,
          basic_salary, hra, special_allowance, staff_advance, professional_tax, tds, net_payable, status
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26
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
          pr.totalDays, pr.workingDays, pr.paidDays, pr.halfDays,
          pr.monthlyEarning, pr.perDaySalary, pr.lopDays, pr.lopAmount, pr.netEarning,
          pr.basicSalary, pr.hra, pr.specialAllowance, pr.staffAdvance, pr.professionalTax, pr.tds, pr.netPayable, 'pending'
        ]
      );
    }

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

module.exports = {
  getPayrollRecords,
  calculatePayroll,
  updatePayrollStatus,
  exportPayroll
};
