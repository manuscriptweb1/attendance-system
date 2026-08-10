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

module.exports = {
  verifyPin,
  checkSession,
  runSimulation,
  exportReport
};
