const pool = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // 1. Total Employees
    const totalEmployeesResult = await pool.query('SELECT COUNT(*) FROM employees');
    const totalEmployees = parseInt(totalEmployeesResult.rows[0].count, 10);

    // 2. Active Employees
    const activeEmployeesResult = await pool.query("SELECT COUNT(*) FROM employees WHERE status = 'active' OR status = 'Active'");
    const activeEmployees = parseInt(activeEmployeesResult.rows[0].count, 10);

    // 3. Currently Working
    const currentlyWorkingResult = await pool.query(`
      SELECT COUNT(*) FROM attendance 
      WHERE attendance_date = $1 
      AND login_time IS NOT NULL 
      AND logout_time IS NULL
    `, [today]);
    const currentlyWorking = parseInt(currentlyWorkingResult.rows[0].count, 10);

    // 4. Monthly Payroll
    // Check payroll_records for current month/year
    const payrollRecordsResult = await pool.query(`
      SELECT SUM(net_payable) as total_payroll FROM payroll_records 
      WHERE payroll_month = $1 AND payroll_year = $2
    `, [currentMonth, currentYear]);

    let monthlyPayroll = parseFloat(payrollRecordsResult.rows[0].total_payroll);

    // If not calculated yet, show estimated
    if (isNaN(monthlyPayroll) || monthlyPayroll === 0) {
      const estimatedResult = await pool.query(`
        SELECT SUM(monthly_salary) as estimated_payroll FROM employees 
        WHERE status = 'active' OR status = 'Active'
      `);
      monthlyPayroll = parseFloat(estimatedResult.rows[0].estimated_payroll) || 0;
    }

    res.json({
      success: true,
      stats: {
        totalEmployees,
        activeEmployees,
        currentlyWorking,
        monthlyPayroll
      }
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getDashboardStats
};
