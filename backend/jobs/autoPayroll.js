const pool = require('../config/database');
const { buildMonthlyPayroll } = require('../services/attendanceReportService');

/**
 * Helper to get current month and year in IST
 */
const getCurrentMonthAndYear = () => {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const localTime = new Date(now.getTime() + (istOffset * 60 * 1000));
  const year = localTime.getUTCFullYear();
  const month = localTime.getUTCMonth() + 1; // 1 to 12
  return { month, year };
};

/**
 * Automatically calculate payroll for a given month and year at auto checkout time
 */
const autoCalculatePayroll = async (targetMonth = null, targetYear = null) => {
  try {
    const { month: currentMonth, year: currentYear } = getCurrentMonthAndYear();
    const month = targetMonth || currentMonth;
    const year = targetYear || currentYear;

    console.log(`🔄 Automatically calculating payroll for ${month}/${year} at auto-checkout time...`);
    const calculatedRecords = await buildMonthlyPayroll(month, year);

    for (const pr of calculatedRecords) {
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
          status = EXCLUDED.status,
          is_manual_edited = EXCLUDED.is_manual_edited,
          updated_at = CURRENT_TIMESTAMP`,
        [
          pr.employeeCode, pr.employeeCode, month, year,
          pr.presentDays, pr.lateDays, pr.absentDays, pr.blankUnmarkedDays, pr.holidayDays,
          pr.totalDays, pr.workingDays, pr.paidDays, pr.halfDays, pr.halfDayLossAmount,
          pr.monthlyEarning, pr.perDaySalary, pr.lopDays, pr.lopAmount, pr.netEarning,
          pr.basicSalary, pr.hra, pr.specialAllowance, pr.staffAdvance, pr.professionalTax, pr.tds, pr.netPayable, pr.status || 'pending', pr.is_manual_edited || false
        ]
      );
    }

    console.log(`✅ Auto payroll calculation completed for ${month}/${year}: ${calculatedRecords.length} record(s) updated.`);
    return {
      success: true,
      recordsCount: calculatedRecords.length,
      month,
      year
    };

  } catch (error) {
    console.error('❌ Auto payroll calculation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = { autoCalculatePayroll };
