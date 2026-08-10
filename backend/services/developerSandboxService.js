const pool = require('../config/database');
const { calculateRepaymentSchedule, toPaise, toRupees } = require('./loanSchedulerService');

/**
 * Deep clone an object to ensure complete in-memory isolation
 */
function cloneData(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Helper: Reuses the exact production repayment schedule logic from loanSchedulerService.
 * Validates that total sum equals total loan amount and total instalments equal duration.
 */
function getLoanRepaymentSchedule(loan) {
  const totalRupees = toRupees(loan.total_loan_amount_paise);
  const months = parseInt(loan.repayment_months) || 1;
  const startMonth = parseInt(loan.first_deduction_month);
  const startYear = parseInt(loan.first_deduction_year);

  // Reuse canonical repayment schedule calculation
  const result = calculateRepaymentSchedule(totalRupees, months, startMonth, startYear);

  // Validation Check: Total sum must equal total loan amount, count must equal repayment months
  const sumPaise = result.schedule.reduce((sum, item) => sum + item.scheduledAmountPaise, 0);
  if (sumPaise !== result.totalPaise || result.schedule.length !== months) {
    throw new Error(
      `Simulation Validation Error for Loan ${loan.loan_code}: Total of simulated instalments (₹${toRupees(sumPaise)}) does not equal total loan amount (₹${toRupees(result.totalPaise)}) or count (${result.schedule.length}) does not match repayment period (${months} months).`
    );
  }

  return result;
}

/**
 * Build Simulation Context by fetching production records via read-only queries
 * and cloning them into an isolated memory context.
 */
async function createSimulationContext(month, year, employeeIdFilter = 'all') {
  const numMonth = parseInt(month);
  const numYear = parseInt(year);

  // 1. Fetch Employees (Read-Only)
  let empQuery = `
    SELECT e.id, e.employee_id as employee_code, e.name, e.job_role, e.monthly_salary as monthly_earning, e.monthly_salary,
           e.department_id, d.name as department_name, e.status
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.status = 'Active'
  `;
  const empParams = [];
  if (employeeIdFilter && employeeIdFilter !== 'all') {
    empParams.push(String(employeeIdFilter));
    empQuery += ` AND (e.id::text = $1 OR e.employee_id::text = $1)`;
  }
  empQuery += ` ORDER BY e.name ASC`;

  const empRes = await pool.query(empQuery, empParams);

  // 2. Fetch Payroll Records for Month/Year (Read-Only)
  const prRes = await pool.query(
    `SELECT * FROM payroll_records WHERE payroll_month = $1 AND payroll_year = $2`,
    [numMonth, numYear]
  );

  // 3. Fetch Loans (Read-Only)
  const loansRes = await pool.query(
    `SELECT el.*, e.name as employee_name, d.name as department_name
     FROM employee_loans el
     JOIN employees e ON el.employee_id::text = e.id::text OR el.employee_code::text = e.employee_id::text
     LEFT JOIN departments d ON e.department_id = d.id
     ORDER BY el.id ASC`
  );

  // 4. Fetch Repayment Transactions (Read-Only)
  const txRes = await pool.query(
    `SELECT * FROM loan_repayment_transactions ORDER BY id ASC`
  );

  // 5. Fetch Settings (Read-Only)
  const settingsRes = await pool.query(`SELECT * FROM settings LIMIT 1`);
  const settings = settingsRes.rows[0] || {};

  return {
    month: numMonth,
    year: numYear,
    employees: cloneData(empRes.rows),
    payrollRecords: cloneData(prRes.rows),
    loans: cloneData(loansRes.rows),
    transactions: cloneData(txRes.rows),
    settings: cloneData(settings)
  };
}

/**
 * 1. Payroll Simulation (Side-by-side REAL vs SIMULATED)
 */
function simulatePayroll(simContext, overrides = {}) {
  const { month, year, employees, payrollRecords, loans } = simContext;
  const results = [];

  for (const emp of employees) {
    const empCode = emp.employee_code || String(emp.id);
    const empOverrides = overrides[empCode] || overrides[emp.id] || {};

    // Find REAL payroll record if calculated
    const realPR = payrollRecords.find(
      r => String(r.employee_id) === String(emp.id) || String(r.employee_code) === empCode
    );

    const baseMonthlyEarning = parseFloat(empOverrides.monthlyEarning ?? realPR?.monthly_earning ?? emp.monthly_earning ?? 0);
    const totalDays = parseInt(empOverrides.totalDays ?? realPR?.total_days ?? 31);
    const presentDays = parseFloat(empOverrides.presentDays ?? realPR?.present_days ?? 31);
    const halfDays = parseFloat(empOverrides.halfDays ?? realPR?.half_days ?? 0);
    const lopDays = parseFloat(empOverrides.lopDays ?? realPR?.lop_days ?? 0);
    const lateDays = parseFloat(empOverrides.lateDays ?? realPR?.late_days ?? 0);
    const overtimeHours = parseFloat(empOverrides.overtimeHours ?? 0);

    const hasAttendanceOverride = (
      empOverrides.presentDays !== undefined ||
      empOverrides.halfDays !== undefined ||
      empOverrides.lopDays !== undefined ||
      empOverrides.overtimeHours !== undefined
    );

    let lopAmount = 0;
    let halfDayLossAmount = 0;
    let netEarning = 0;
    let perDaySalary = totalDays > 0 ? baseMonthlyEarning / totalDays : 0;

    if (realPR && !hasAttendanceOverride) {
      lopAmount = parseFloat(realPR.lop_amount || 0);
      halfDayLossAmount = parseFloat(realPR.half_day_loss_amount || 0);
      netEarning = parseFloat(realPR.net_earning || 0);
      perDaySalary = parseFloat(realPR.per_day_salary || perDaySalary);
    } else {
      halfDayLossAmount = halfDays * (perDaySalary * 0.5);
      lopAmount = lopDays * perDaySalary;
      const overtimeEarning = overtimeHours * (perDaySalary / 8);
      netEarning = Math.max(0, baseMonthlyEarning - lopAmount - halfDayLossAmount + overtimeEarning);
    }

    const basicSalary = parseFloat((netEarning * 0.5).toFixed(2));
    const hra = parseFloat((netEarning * 0.3).toFixed(2));
    const specialAllowance = parseFloat((netEarning * 0.2).toFixed(2));

    const staffAdvance = parseFloat(empOverrides.staffAdvance ?? realPR?.staff_advance ?? 0);
    const pt = parseFloat(empOverrides.professional_tax ?? realPR?.professional_tax ?? (netEarning > 15000 ? 200 : 0));
    const tds = parseFloat(empOverrides.tds ?? realPR?.tds ?? 0);

    // Calculate Loan Deduction in memory using canonical calculateRepaymentSchedule
    let simLoanDeduction = 0;
    let simLoanDeductionStatus = 'Not Applicable';
    let simLoanCode = null;

    const activeLoan = loans.find(l =>
      (String(l.employee_id) === String(emp.id) || String(l.employee_code) === empCode) &&
      ['Active', 'Scheduled'].includes(l.status) &&
      parseInt(l.remaining_balance_paise) > 0
    );

    if (activeLoan) {
      try {
        const schRes = getLoanRepaymentSchedule(activeLoan);
        const currentInstalment = schRes.schedule.find(
          s => s.payrollMonth === month && s.payrollYear === year
        );

        if (currentInstalment) {
          simLoanCode = activeLoan.loan_code;
          const expectedPaise = currentInstalment.scheduledAmountPaise;
          const availRupees = Math.max(0, netEarning - staffAdvance - pt - tds);
          const availPaise = toPaise(availRupees);
          const actualPaise = Math.min(expectedPaise, availPaise);

          simLoanDeduction = toRupees(actualPaise);
          simLoanDeductionStatus = availPaise === 0 ? 'Skipped' : (actualPaise < expectedPaise ? 'Partially Posted' : 'Pending');
        }
      } catch (err) {
        console.warn(`Simulation Warning for ${emp.name} loan calculation:`, err.message);
      }
    }

    const simTotalDeductions = lopAmount + halfDayLossAmount + staffAdvance + pt + tds + simLoanDeduction;
    const simNetPayable = Math.max(0, netEarning - staffAdvance - pt - tds - simLoanDeduction);

    results.push({
      employeeId: emp.id,
      employeeCode: empCode,
      employeeName: emp.name,
      department: emp.department_name || 'N/A',
      real: realPR ? {
        grossSalary: parseFloat(realPR.monthly_earning || 0),
        netEarning: parseFloat(realPR.net_earning || 0),
        lopAmount: parseFloat(realPR.lop_amount || 0),
        halfDayLoss: parseFloat(realPR.half_day_loss_amount || 0),
        staffAdvance: parseFloat(realPR.staff_advance || 0),
        professionalTax: parseFloat(realPR.professional_tax || 0),
        tds: parseFloat(realPR.tds || 0),
        loanDeduction: parseFloat(realPR.loan_deduction || 0),
        loanDeductionStatus: realPR.loan_deduction_status || 'Not Applicable',
        totalDeductions: parseFloat(realPR.lop_amount || 0) + parseFloat(realPR.half_day_loss_amount || 0) + parseFloat(realPR.staff_advance || 0) + parseFloat(realPR.professional_tax || 0) + parseFloat(realPR.tds || 0) + parseFloat(realPR.loan_deduction || 0),
        netPayable: parseFloat(realPR.net_payable || 0)
      } : null,
      simulated: {
        grossSalary: baseMonthlyEarning,
        netEarning: parseFloat(netEarning.toFixed(2)),
        perDaySalary: parseFloat(perDaySalary.toFixed(2)),
        basicSalary,
        hra,
        specialAllowance,
        presentDays,
        halfDays,
        lopDays,
        lateDays,
        overtimeHours,
        halfDayLoss: parseFloat(halfDayLossAmount.toFixed(2)),
        lopAmount: parseFloat(lopAmount.toFixed(2)),
        staffAdvance,
        professionalTax: pt,
        tds,
        loanDeduction: simLoanDeduction,
        loanDeductionStatus: simLoanDeductionStatus,
        loanCode: simLoanCode,
        totalDeductions: parseFloat(simTotalDeductions.toFixed(2)),
        netPayable: parseFloat(simNetPayable.toFixed(2))
      }
    });
  }

  return results;
}

/**
 * 2. Employee Loan Simulation & Timeline Generator (Reuses calculateRepaymentSchedule)
 */
function simulateLoanTimeline(simContext, loanId, monthsHorizon = 12) {
  const { loans } = simContext;
  const loan = loans.find(l => String(l.id) === String(loanId));

  if (!loan) {
    return { success: false, message: 'Loan not found in simulation context' };
  }

  try {
    const scheduleRes = getLoanRepaymentSchedule(loan);
    const timeline = [];

    let completedInstalments = 0;
    let totalPostedPaise = 0;

    for (const item of scheduleRes.schedule) {
      completedInstalments += 1;
      totalPostedPaise += item.scheduledAmountPaise;

      const isFinal = (completedInstalments === scheduleRes.repaymentMonths);
      const status = isFinal ? 'Completed' : 'Active';

      timeline.push({
        step: item.instalmentNumber,
        payrollMonth: item.payrollMonth,
        payrollYear: item.payrollYear,
        periodLabel: `${item.payrollMonth}/${item.payrollYear}`,
        loanDeduction: item.scheduledAmountRupees,
        totalRepaid: toRupees(totalPostedPaise),
        remainingBalance: item.remainingBalanceRupees,
        completedInstalments,
        totalInstalments: scheduleRes.repaymentMonths,
        status
      });

      if (timeline.length >= monthsHorizon) {
        break;
      }
    }

    return {
      success: true,
      loanCode: loan.loan_code,
      employeeName: loan.employee_name,
      employeeCode: loan.employee_code,
      totalLoanAmount: scheduleRes.totalRupees,
      repaymentMonths: scheduleRes.repaymentMonths,
      monthlyDeduction: scheduleRes.monthlyScheduledDeductionRupees,
      timeline
    };

  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * 3. Month-End Scheduler Simulation (Step-by-step trace log in memory using calculateRepaymentSchedule)
 */
function simulateSchedulerRun(simContext) {
  const { month, year, loans } = simContext;
  const logs = [];

  logs.push(`[SIMULATION STARTED] Scheduler Month-End Dry Run for ${month}/${year}`);
  logs.push(`[MEMORIZED CONTEXT] Total loans evaluated: ${loans.length}`);

  let totalEligible = 0;
  let totalSimulatedPosted = 0;
  let simulatedAmountTotal = 0;

  for (const loan of loans) {
    logs.push(`----------------------------------------------------`);
    logs.push(`[EVALUATE] Loan ${loan.loan_code} for ${loan.employee_name} (${loan.employee_code})`);

    if (!['Active', 'Scheduled'].includes(loan.status) || parseInt(loan.remaining_balance_paise) <= 0) {
      logs.push(`  - [SKIP] Loan is not active or has 0 balance.`);
      continue;
    }

    try {
      const schRes = getLoanRepaymentSchedule(loan);
      const currentInstalment = schRes.schedule.find(
        s => s.payrollMonth === month && s.payrollYear === year
      );

      if (!currentInstalment) {
        logs.push(`  - [SKIP] No repayment scheduled for simulation month ${month}/${year}.`);
        continue;
      }

      totalEligible++;

      const deductionRupees = currentInstalment.scheduledAmountRupees;
      const remRupees = currentInstalment.remainingBalanceRupees;
      const totalRepaidRupees = currentInstalment.cumulativeRupees;

      simulatedAmountTotal += deductionRupees;
      totalSimulatedPosted++;

      logs.push(`  - [CALCULATED SCHEDULED DEDUCTION] Instalment #${currentInstalment.instalmentNumber}/${schRes.repaymentMonths}: ₹${deductionRupees}`);
      logs.push(`  - [SIMULATED TRANSACTION] Code: TX-SIM-${loan.id}-${year}-${String(month).padStart(2, '0')} | Status: Posted | Amount: ₹${deductionRupees}`);
      logs.push(`  - [SIMULATED BALANCES] Remaining: ₹${remRupees} | Total Repaid: ₹${totalRepaidRupees}`);
      logs.push(`  - [DATABASE IMMUTABILITY GUARANTEE] 0 database writes executed.`);
    } catch (err) {
      logs.push(`  - [SIMULATION ERROR] ${err.message}`);
    }
  }

  logs.push(`----------------------------------------------------`);
  logs.push(`[SIMULATION COMPLETED] Processed: ${totalEligible}, Posted: ${totalSimulatedPosted}, Total Deduction Amount: ₹${simulatedAmountTotal.toFixed(2)}`);

  return {
    success: true,
    month,
    year,
    totalChecked: loans.length,
    totalEligible,
    totalSimulatedPosted,
    simulatedAmountTotal: parseFloat(simulatedAmountTotal.toFixed(2)),
    logs
  };
}

/**
 * 4. Multi-Month Projection Simulation (1, 3, 6, 12 Months using calculateRepaymentSchedule)
 */
function simulateMultiMonthProgression(simContext, monthsHorizon = 6) {
  const { month, year, loans } = simContext;
  const progression = [];

  const loanSchedules = [];
  for (const l of loans) {
    try {
      loanSchedules.push({
        loan: cloneData(l),
        scheduleRes: getLoanRepaymentSchedule(l)
      });
    } catch (err) {
      console.warn(`MultiMonthProgression warning for loan ${l.loan_code}:`, err.message);
    }
  }

  let currMonth = month;
  let currYear = year;

  for (let m = 1; m <= monthsHorizon; m++) {
    let monthTotalDeduction = 0;
    let monthActiveLoans = 0;
    let monthCompletedLoans = 0;
    const loanDetails = [];

    for (const item of loanSchedules) {
      const { loan, scheduleRes } = item;

      const schInstalment = scheduleRes.schedule.find(
        s => s.payrollMonth === currMonth && s.payrollYear === currYear
      );

      if (schInstalment) {
        monthActiveLoans++;

        const deductionRupees = schInstalment.scheduledAmountRupees;
        const remainingBalanceRupees = schInstalment.remainingBalanceRupees;
        const isCompleted = (schInstalment.instalmentNumber === scheduleRes.repaymentMonths);
        const status = isCompleted ? 'Completed' : 'Active';

        if (isCompleted) {
          monthCompletedLoans++;
        }

        monthTotalDeduction += deductionRupees;

        loanDetails.push({
          loanId: loan.id,
          loanCode: loan.loan_code,
          employeeName: loan.employee_name,
          employeeCode: loan.employee_code,
          deduction: deductionRupees,
          remainingBalance: remainingBalanceRupees,
          status,
          completedInstalments: schInstalment.instalmentNumber
        });
      }
    }

    progression.push({
      step: m,
      month: currMonth,
      year: currYear,
      periodLabel: `${currMonth}/${currYear}`,
      totalDeduction: parseFloat(monthTotalDeduction.toFixed(2)),
      activeLoansCount: monthActiveLoans,
      completedCount: monthCompletedLoans,
      loanDetails
    });

    currMonth++;
    if (currMonth > 12) {
      currMonth = 1;
      currYear++;
    }
  }

  return progression;
}

module.exports = {
  createSimulationContext,
  simulatePayroll,
  simulateLoanTimeline,
  simulateSchedulerRun,
  simulateMultiMonthProgression
};
