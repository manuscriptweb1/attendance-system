const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  createSimulationContext,
  simulatePayroll,
  simulateLoanTimeline,
  simulateSchedulerRun,
  simulateMultiMonthProgression
} = require('../services/developerSandboxService');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_sandbox_secret_key_2026';

/**
 * Developer PIN Authentication
 */
const verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(401).json({ success: false, message: 'Invalid PIN' });
    }

    const settingsRes = await pool.query(`SELECT developer_pin_hash FROM developer_settings WHERE id = 1 LIMIT 1`);

    if (settingsRes.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid PIN' });
    }

    const pinHash = settingsRes.rows[0].developer_pin_hash;
    const isMatch = await bcrypt.compare(String(pin), pinHash);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid PIN' });
    }

    // Success: Generate 30-minute Developer Session Token
    const token = jwt.sign(
      { developerId: 1, isDeveloperSession: true },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    return res.json({
      success: true,
      token,
      expiresIn: 1800,
      message: 'Developer Session Verified'
    });

  } catch (err) {
    console.error('Verify PIN error:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }
};

/**
 * Verify Active Developer Session Status
 */
const checkSession = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.isDeveloperSession) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid' });
    }

    return res.json({ success: true, valid: true });

  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid' });
  }
};

/**
 * Execute Full Sandbox Simulation (100% In-Memory)
 */
const runSimulation = async (req, res) => {
  try {
    const {
      month = new Date().getMonth() + 1,
      year = new Date().getFullYear(),
      employeeIdFilter = 'all',
      attendanceOverrides = {},
      monthsHorizon = 6,
      selectedLoanId = null
    } = req.body;

    // 1. Create In-Memory Simulation Context (Read-Only queries, Cloned data)
    const simContext = await createSimulationContext(month, year, employeeIdFilter);

    // 2. Payroll & Attendance Simulation
    const payrollResults = simulatePayroll(simContext, attendanceOverrides);

    // 3. Scheduler Simulation
    const schedulerResult = simulateSchedulerRun(simContext);

    // 4. Multi-Month Timeline Progression Simulation
    const multiMonthProgression = simulateMultiMonthProgression(simContext, parseInt(monthsHorizon) || 6);

    // 5. Loan Specific Timeline (if loan ID provided or pick first active loan)
    let loanTimelineResult = null;
    const targetLoanId = selectedLoanId || (simContext.loans[0] ? simContext.loans[0].id : null);

    if (targetLoanId) {
      loanTimelineResult = simulateLoanTimeline(simContext, targetLoanId, parseInt(monthsHorizon) || 12);
    }

    // Summary Card Totals
    const totalSimulatedGross = payrollResults.reduce((sum, r) => sum + r.simulated.grossSalary, 0);
    const totalSimulatedDeductions = payrollResults.reduce((sum, r) => sum + r.simulated.totalDeductions, 0);
    const totalSimulatedNetPayable = payrollResults.reduce((sum, r) => sum + r.simulated.netPayable, 0);
    const totalSimulatedLoanDeductions = payrollResults.reduce((sum, r) => sum + r.simulated.loanDeduction, 0);

    return res.json({
      success: true,
      simulationMode: true,
      readOnly: true,
      dbWritesPerformed: 0,
      context: {
        month: parseInt(month),
        year: parseInt(year),
        employeeIdFilter,
        totalEmployees: simContext.employees.length,
        totalLoans: simContext.loans.length
      },
      summary: {
        totalSimulatedGross: parseFloat(totalSimulatedGross.toFixed(2)),
        totalSimulatedDeductions: parseFloat(totalSimulatedDeductions.toFixed(2)),
        totalSimulatedNetPayable: parseFloat(totalSimulatedNetPayable.toFixed(2)),
        totalSimulatedLoanDeductions: parseFloat(totalSimulatedLoanDeductions.toFixed(2))
      },
      payroll: payrollResults,
      scheduler: schedulerResult,
      multiMonthProgression,
      loanTimeline: loanTimelineResult,
      availableLoans: simContext.loans.map(l => ({
        id: l.id,
        loanCode: l.loan_code,
        employeeName: l.employee_name,
        totalAmount: l.total_loan_amount_paise / 100,
        status: l.status
      })),
      availableEmployees: simContext.employees.map(e => ({
        id: e.id,
        employeeCode: e.employee_code,
        name: e.name,
        department: e.department_name
      }))
    });

  } catch (err) {
    console.error('Run simulation error:', err);
    return res.status(500).json({ success: false, message: 'Server error running developer simulation' });
  }
};

/**
 * Export Simulation Report (JSON)
 */
const exportReport = async (req, res) => {
  try {
    const { simulationData, format = 'json' } = req.body;

    if (!simulationData) {
      return res.status(400).json({ success: false, message: 'Simulation data required' });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=Developer_Simulation_Report_${Date.now()}.json`);
      return res.send(JSON.stringify(simulationData, null, 2));
    }

    return res.json({ success: true, report: simulationData });

  } catch (err) {
    console.error('Export report error:', err);
    return res.status(500).json({ success: false, message: 'Server error exporting simulation report' });
  }
};

const {
  getBrandingSettings,
  updateBrandingSettings,
  resetBrandingLogo
} = require('../utils/brandingSettingsHelper');
const { generateSinglePayslipBuffer } = require('../utils/payslipGenerator');
const { generateEmployeeFormBuffer } = require('../utils/employeeFormGenerator');

/**
 * Get Current PDF Branding Settings
 */
const getBranding = async (req, res) => {
  try {
    const branding = await getBrandingSettings();
    return res.json({
      success: true,
      branding
    });
  } catch (err) {
    console.error('Get branding error:', err);
    return res.status(500).json({ success: false, message: 'Error retrieving branding settings' });
  }
};

/**
 * Update PDF Branding Settings
 */
const updateBranding = async (req, res) => {
  try {
    const {
      company_name,
      logo_base64,
      logo_width,
      logo_height,
      company_name_font_size,
      registered_office_address
    } = req.body;

    const updated = await updateBrandingSettings({
      company_name,
      logo_base64,
      logo_width,
      logo_height,
      company_name_font_size,
      registered_office_address
    });

    return res.json({
      success: true,
      message: 'Company branding settings updated successfully',
      branding: updated
    });
  } catch (err) {
    console.error('Update branding error:', err);
    return res.status(500).json({ success: false, message: 'Error updating branding settings' });
  }
};

/**
 * Reset Branding Logo to Default
 */
const resetLogo = async (req, res) => {
  try {
    const updated = await resetBrandingLogo();
    return res.json({
      success: true,
      message: 'Logo reset to default successfully',
      branding: updated
    });
  } catch (err) {
    console.error('Reset logo error:', err);
    return res.status(500).json({ success: false, message: 'Error resetting logo' });
  }
};

/**
 * Download Sample Test PDF with Current Branding
 */
const downloadSamplePdf = async (req, res) => {
  try {
    const { type = 'payslip' } = req.query;
    const branding = await getBrandingSettings();

    if (type === 'employee_details') {
      const sampleEmp = {
        employee_id: 'SAMPLE-01',
        name: 'SAMPLE EMPLOYEE',
        job_role: 'SENIOR DEVELOPER',
        department_name: 'ENGINEERING',
        joining_date: new Date().toISOString(),
        date_of_birth: '1995-05-15',
        mobile: '+91 9876543210',
        alternate_phone_number: '+91 9123456780',
        email: 'sample.employee@company.com',
        permanent_address: '123 Tech Park, 4th Block, Sample City, State, 560001',
        bank_name: 'STATE BANK OF INDIA',
        account_holder_name: 'SAMPLE EMPLOYEE',
        account_number: '123456789012',
        ifsc_code: 'SBIN0001234',
        bank_address: 'Main Branch, Sample City',
        pan_card_number: 'ABCDE1234F',
        aadhar_card_number: '123456789012',
        monthly_salary: 50000,
        basic_salary: 25000,
        hra: 10000,
        special_allowance: 15000,
        professional_tax: 200,
        tds: 0,
        staff_advance: 0
      };

      const buffer = await generateEmployeeFormBuffer(sampleEmp, { branding });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=sample_employee_details_${Date.now()}.pdf`);
      return res.send(buffer);
    } else {
      // Default: Sample Payslip
      const samplePayrollRecord = {
        emp_code_real: 'SAMPLE-01',
        employee_name: 'SAMPLE EMPLOYEE',
        job_role: 'SENIOR DEVELOPER',
        department_name: 'ENGINEERING',
        working_days: 30,
        paid_days: 30,
        present_days: 28,
        half_days: 0,
        absent_days: 0,
        lop_days: 0,
        basic_salary: 25000,
        hra: 10000,
        special_allowance: 15000,
        gross_earnings: 50000,
        lop_amount: 0,
        professional_tax: 200,
        tds: 0,
        staff_advance: 0,
        loan_deduction: 0,
        total_deductions: 200,
        net_payable: 49800
      };

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const buffer = await generateSinglePayslipBuffer(samplePayrollRecord, currentMonth, currentYear, { branding });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=sample_payslip_${Date.now()}.pdf`);
      return res.send(buffer);
    }
  } catch (err) {
    console.error('Download sample PDF error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Error generating sample PDF' });
    }
  }
};

module.exports = {
  verifyPin,
  checkSession,
  runSimulation,
  exportReport,
  getBranding,
  updateBranding,
  resetLogo,
  downloadSamplePdf
};

