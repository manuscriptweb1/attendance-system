const pool = require('../config/database');
const cron = require('node-cron');

/**
 * Utility: Convert Rupees to integer Paise (e.g. ₹6000.00 -> 600000)
 */
function toPaise(rupees) {
  const num = parseFloat(rupees) || 0;
  return Math.round(num * 100);
}

/**
 * Utility: Convert integer Paise to Rupees float (e.g. 600000 -> 6000)
 */
function toRupees(paise) {
  const num = parseInt(paise) || 0;
  return parseFloat((num / 100).toFixed(2));
}

/**
 * Flexible Loan Calculation Mode Engine
 * Mode 1 (by_months): Calculates Monthly Deduction from Loan Amount & Repayment Months.
 * Mode 2 (by_emi): Calculates Repayment Months from Loan Amount & Monthly Deduction.
 * Automatically adjusts final instalment so sum of all instalments equals loan amount.
 * Small remainders (<= 50 paise) are absorbed into the last EMI rather than generating a 1-paise extra EMI.
 */
function calculateRepaymentScheduleFlexible({
  totalAmountRupees,
  calculationMode = 'by_months',
  durationMonths = 1,
  monthlyEMIRupees = 0,
  startMonth,
  startYear
}) {
  const totalPaise = toPaise(totalAmountRupees);
  let scheduleMode = calculationMode === 'by_emi' ? 'by_emi' : 'by_months';
  let months = parseInt(durationMonths) || 1;

  if (scheduleMode === 'by_emi') {
    const emiPaise = toPaise(monthlyEMIRupees);
    if (emiPaise <= 0 || totalPaise <= 0) {
      months = 1;
    } else {
      let rawMonths = Math.ceil(totalPaise / emiPaise);
      if (rawMonths > 1) {
        let remainderPaise = totalPaise - (emiPaise * (rawMonths - 1));
        // If remainder is small (<= 50 paise), absorb into previous month instead of creating extra 1-paise month
        if (remainderPaise > 0 && remainderPaise <= 50) {
          months = rawMonths - 1;
        } else {
          months = rawMonths;
        }
      } else {
        months = 1;
      }
    }
  }

  // Cap months between 1 and 120
  months = Math.max(1, Math.min(120, months));

  const schedule = [];
  let currMonth = parseInt(startMonth) || (new Date().getMonth() + 1);
  let currYear = parseInt(startYear) || new Date().getFullYear();
  let cumulativePaise = 0;

  if (scheduleMode === 'by_emi') {
    const targetEmiPaise = toPaise(monthlyEMIRupees);
    let remainingPaise = totalPaise;

    for (let i = 1; i <= months; i++) {
      let instalmentPaise;
      if (i === months) {
        // Last instalment absorbs all remaining balance
        instalmentPaise = remainingPaise;
      } else {
        instalmentPaise = Math.min(targetEmiPaise, remainingPaise);
      }

      remainingPaise -= instalmentPaise;
      cumulativePaise += instalmentPaise;

      schedule.push({
        instalmentNumber: i,
        payrollMonth: currMonth,
        payrollYear: currYear,
        scheduledAmountPaise: instalmentPaise,
        scheduledAmountRupees: toRupees(instalmentPaise),
        cumulativePaise,
        cumulativeRupees: toRupees(cumulativePaise),
        remainingBalancePaise: totalPaise - cumulativePaise,
        remainingBalanceRupees: toRupees(totalPaise - cumulativePaise)
      });

      currMonth++;
      if (currMonth > 12) {
        currMonth = 1;
        currYear++;
      }
    }
  } else {
    // Mode 1: By Repayment Months
    const baseMonthlyPaise = Math.floor(totalPaise / months);
    let remainderPaise = totalPaise - (baseMonthlyPaise * months);

    for (let i = 1; i <= months; i++) {
      let instalmentPaise = baseMonthlyPaise;
      if (i === months) {
        instalmentPaise += remainderPaise;
      }
      cumulativePaise += instalmentPaise;

      schedule.push({
        instalmentNumber: i,
        payrollMonth: currMonth,
        payrollYear: currYear,
        scheduledAmountPaise: instalmentPaise,
        scheduledAmountRupees: toRupees(instalmentPaise),
        cumulativePaise,
        cumulativeRupees: toRupees(cumulativePaise),
        remainingBalancePaise: totalPaise - cumulativePaise,
        remainingBalanceRupees: toRupees(totalPaise - cumulativePaise)
      });

      currMonth++;
      if (currMonth > 12) {
        currMonth = 1;
        currYear++;
      }
    }
  }

  const expectedCompletionMonth = schedule[schedule.length - 1] ? schedule[schedule.length - 1].payrollMonth : currMonth;
  const expectedCompletionYear = schedule[schedule.length - 1] ? schedule[schedule.length - 1].payrollYear : currYear;
  const baseScheduledPaise = schedule[0] ? schedule[0].scheduledAmountPaise : 0;
  const lastInstalmentPaise = schedule[schedule.length - 1] ? schedule[schedule.length - 1].scheduledAmountPaise : 0;

  return {
    totalPaise,
    totalRupees: toRupees(totalPaise),
    repaymentMonths: months,
    calculationMode: scheduleMode,
    monthlyScheduledDeductionPaise: baseScheduledPaise,
    monthlyScheduledDeductionRupees: toRupees(baseScheduledPaise),
    lastInstalmentPaise,
    lastInstalmentRupees: toRupees(lastInstalmentPaise),
    expectedCompletionMonth,
    expectedCompletionYear,
    schedule
  };
}

function calculateRepaymentSchedule(totalAmountRupees, durationMonths, startMonth, startYear) {
  return calculateRepaymentScheduleFlexible({
    totalAmountRupees,
    calculationMode: 'by_months',
    durationMonths,
    startMonth,
    startYear
  });
}

/**
 * Get active/scheduled loan applicable for a specific employee and payroll month.
 * Calculates expected loan deduction without modifying loan state.
 */
async function getCalculatedLoanDeductionForEmployee(employeeIdOrCode, month, year, salaryAvailableBeforeLoanRupees = 0) {
  try {
    const numMonth = parseInt(month);
    const numYear = parseInt(year);

    // Find active or scheduled loan where (year > first_year OR (year = first_year AND month >= first_month))
    const loanRes = await pool.query(
      `SELECT * FROM employee_loans
       WHERE (employee_id::text = $1 OR employee_code::text = $1)
         AND status IN ('Scheduled', 'Active')
         AND (
           first_deduction_year < $2 OR
           (first_deduction_year = $2 AND first_deduction_month <= $3)
         )
         AND remaining_balance_paise > 0
       ORDER BY id ASC
       LIMIT 1`,
      [String(employeeIdOrCode), numYear, numMonth]
    );

    if (loanRes.rows.length === 0) {
      return {
        hasLoan: false,
        loanDeductionRupees: 0,
        loanDeductionPaise: 0,
        status: 'Not Applicable',
        loanId: null
      };
    }

    const loan = loanRes.rows[0];
    const totalRupees = toRupees(loan.total_loan_amount_paise);
    const scheduleData = calculateRepaymentSchedule(totalRupees, loan.repayment_months, loan.first_deduction_month, loan.first_deduction_year);

    const currentInstalment = scheduleData.schedule.find(
      s => s.payrollMonth === numMonth && s.payrollYear === numYear
    );

    if (!currentInstalment) {
      return {
        hasLoan: false,
        loanDeductionRupees: 0,
        loanDeductionPaise: 0,
        status: 'Not Applicable',
        loanId: null
      };
    }

    const remainingBalancePaise = parseInt(loan.remaining_balance_paise);
    const expectedDeductionPaise = currentInstalment.scheduledAmountPaise;

    const salaryAvailablePaise = Math.max(0, toPaise(salaryAvailableBeforeLoanRupees));
    const actualDeductionPaise = Math.min(expectedDeductionPaise, salaryAvailablePaise);

    let status = 'Pending';
    if (salaryAvailablePaise === 0) {
      status = 'Skipped';
    } else if (actualDeductionPaise < expectedDeductionPaise) {
      status = 'Partially Posted';
    }

    return {
      hasLoan: true,
      loanId: loan.id,
      loanCode: loan.loan_code,
      scheduledPaise: expectedDeductionPaise,
      scheduledRupees: toRupees(expectedDeductionPaise),
      loanDeductionPaise: actualDeductionPaise,
      loanDeductionRupees: toRupees(actualDeductionPaise),
      remainingBalancePaise,
      remainingBalanceRupees: toRupees(remainingBalancePaise),
      status
    };
  } catch (err) {
    console.error('Error calculating loan deduction for employee:', err);
    return {
      hasLoan: false,
      loanDeductionRupees: 0,
      loanDeductionPaise: 0,
      status: 'Not Applicable',
      loanId: null
    };
  }
}

/**
 * Officially post loan deductions for a past payroll month after the month has fully ended.
 * Idempotent: Skips loans that already have a non-reversed transaction for that month.
 */
async function processMonthEndLoanDeductions(month, year, systemAdminId = null) {
  const numMonth = parseInt(month);
  const numYear = parseInt(year);

  // 1. Verify the processing payroll month has fully ended in Asia/Kolkata timezone
  const nowKolkataStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const nowKolkata = new Date(nowKolkataStr);
  const currentMonthKolkata = nowKolkata.getMonth() + 1;
  const currentYearKolkata = nowKolkata.getFullYear();

  const isMonthEnded = (numYear < currentYearKolkata) || (numYear === currentYearKolkata && numMonth < currentMonthKolkata);

  if (!isMonthEnded) {
    const errorMsg = `Cannot process month-end loan deductions for ${numMonth}/${numYear}. The payroll month has not fully ended yet (Current Asia/Kolkata date: ${currentYearKolkata}-${String(currentMonthKolkata).padStart(2, '0')}-${String(nowKolkata.getDate()).padStart(2, '0')}).`;
    console.warn(`⚠️ ${errorMsg}`);
    return {
      success: false,
      message: errorMsg,
      totalChecked: 0,
      totalProcessed: 0,
      totalPosted: 0,
      totalPartiallyPosted: 0,
      totalSkipped: 0,
      totalFailed: 0,
      status: 'Rejected'
    };
  }

  const batchCode = `BATCH-LOAN-${String(numMonth).padStart(2, '0')}-${numYear}-${Date.now()}`;

  console.log(`📌 Starting Month-End Loan Deduction Processing for ${numMonth}/${numYear}...`);

  // Log batch start
  const batchRes = await pool.query(
    `INSERT INTO loan_scheduler_batch_logs (
       batch_code, payroll_month, payroll_year, started_at, status
     ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'Running')
     RETURNING id`,
    [batchCode, numMonth, numYear]
  );
  const batchId = batchRes.rows[0].id;

  let totalChecked = 0;
  let totalProcessed = 0;
  let totalPosted = 0;
  let totalPartiallyPosted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const failureDetails = [];

  try {
    // 1. Fetch all active or scheduled loans eligible for this month
    const loansRes = await pool.query(
      `SELECT el.*, e.name as employee_name
       FROM employee_loans el
       JOIN employees e ON el.employee_id::text = e.id::text OR el.employee_code::text = e.employee_id::text
       WHERE el.status IN ('Scheduled', 'Active')
         AND (
           el.first_deduction_year < $1 OR
           (el.first_deduction_year = $1 AND el.first_deduction_month <= $2)
         )
         AND el.remaining_balance_paise > 0
       ORDER BY el.id ASC`,
      [numYear, numMonth]
    );

    totalChecked = loansRes.rows.length;

    for (const loan of loansRes.rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Lock loan row for atomic update
        const lockedLoanRes = await client.query(
          `SELECT * FROM employee_loans WHERE id = $1 FOR UPDATE`,
          [loan.id]
        );

        if (lockedLoanRes.rows.length === 0) {
          await client.query('ROLLBACK');
          continue;
        }

        const currentLoan = lockedLoanRes.rows[0];

        // Check if already completed or cancelled
        if (['Completed', 'Cancelled'].includes(currentLoan.status) || parseInt(currentLoan.remaining_balance_paise) <= 0) {
          await client.query('ROLLBACK');
          continue;
        }

        // Check if transaction already posted for this loan and month
        const existingTx = await client.query(
          `SELECT id, status FROM loan_repayment_transactions
           WHERE loan_id = $1 AND payroll_month = $2 AND payroll_year = $3`,
          [loan.id, numMonth, numYear]
        );

        if (existingTx.rows.length > 0) {
          const txRow = existingTx.rows[0];
          if (txRow.status !== 'Reversed') {
            // Already posted or partially posted for this month, skip safely
            await client.query('ROLLBACK');
            continue;
          }
        }

        totalProcessed++;

        // Fetch corresponding payroll record for employee
        const prRes = await client.query(
          `SELECT * FROM payroll_records
           WHERE (employee_id::text = $1 OR employee_code::text = $2)
             AND payroll_month::integer = $3 AND payroll_year::integer = $4
           LIMIT 1`,
          [String(loan.employee_id), String(loan.employee_code), numMonth, numYear]
        );

        let salaryAvailableRupees = 0;
        let payrollRecordId = null;

        if (prRes.rows.length > 0) {
          const pr = prRes.rows[0];
          payrollRecordId = pr.id;

          const netEarning = parseFloat(pr.net_earning) || 0;
          const advance = parseFloat(pr.staff_advance) || 0;
          const pt = parseFloat(pr.professional_tax) || 0;
          const tds = parseFloat(pr.tds) || 0;

          salaryAvailableRupees = Math.max(0, netEarning - advance - pt - tds);
        }

        const totalRupees = toRupees(currentLoan.total_loan_amount_paise);
        const scheduleData = calculateRepaymentSchedule(
          totalRupees,
          currentLoan.repayment_months,
          currentLoan.first_deduction_month,
          currentLoan.first_deduction_year
        );

        const currentInstalment = scheduleData.schedule.find(
          s => s.payrollMonth === numMonth && s.payrollYear === numYear
        );

        if (!currentInstalment) {
          await client.query('ROLLBACK');
          continue;
        }

        const remainingBalancePaise = parseInt(currentLoan.remaining_balance_paise);
        const targetInstalmentPaise = currentInstalment.scheduledAmountPaise;

        const availableSalaryPaise = toPaise(salaryAvailableRupees);
        const actualDeductedPaise = Math.min(targetInstalmentPaise, availableSalaryPaise);
        const shortfallPaise = targetInstalmentPaise - actualDeductedPaise;

        let txStatus = 'Posted';
        if (availableSalaryPaise === 0) {
          txStatus = 'Skipped';
        } else if (actualDeductedPaise < targetInstalmentPaise) {
          txStatus = 'Partially Posted';
        }

        const newRemainingBalancePaise = remainingBalancePaise - actualDeductedPaise;
        const newTotalPostedPaise = parseInt(currentLoan.total_posted_deduction_paise) + actualDeductedPaise;

        let newCompletedInstalments = currentLoan.completed_instalments;
        if (actualDeductedPaise > 0) {
          newCompletedInstalments += 1;
        }

        let newLoanStatus = currentLoan.status;
        if (newRemainingBalancePaise === 0) {
          newLoanStatus = 'Completed';
        } else if (currentLoan.status === 'Scheduled' && actualDeductedPaise > 0) {
          newLoanStatus = 'Active';
        }

        const txCode = `TX-LOAN-${loan.id}-${numYear}-${String(numMonth).padStart(2, '0')}`;

        // 1. Create or Update Repayment Transaction
        if (existingTx.rows.length > 0 && existingTx.rows[0].status === 'Reversed') {
          await client.query(
            `UPDATE loan_repayment_transactions
             SET scheduled_deduction_paise = $1,
                 actual_deducted_paise = $2,
                 shortfall_paise = $3,
                 balance_before_paise = $4,
                 balance_after_paise = $5,
                 posting_date = CURRENT_TIMESTAMP,
                 status = $6,
                 reversal_date = NULL,
                 reversal_reason = NULL,
                 reversal_by = NULL,
                 payroll_record_id = $7
             WHERE id = $8`,
            [
              targetInstalmentPaise, actualDeductedPaise,
              shortfallPaise, remainingBalancePaise, newRemainingBalancePaise,
              txStatus, payrollRecordId, existingTx.rows[0].id
            ]
          );
        } else {
          await client.query(
            `INSERT INTO loan_repayment_transactions (
               transaction_code, loan_id, employee_id, payroll_record_id,
               payroll_month, payroll_year, scheduled_deduction_paise, actual_deducted_paise,
               shortfall_paise, balance_before_paise, balance_after_paise, posting_date,
               status, created_by_system
             ) VALUES (
               $1, $2, $3, $4::integer,
               $5, $6, $7, $8,
               $9, $10, $11, CURRENT_TIMESTAMP,
               $12, TRUE
             )`,
            [
              txCode, loan.id, String(loan.employee_code || loan.employee_id), payrollRecordId,
              numMonth, numYear, targetInstalmentPaise, actualDeductedPaise,
              shortfallPaise, remainingBalancePaise, newRemainingBalancePaise,
              txStatus
            ]
          );
        }

        // 2. Update Employee Loan Table
        await client.query(
          `UPDATE employee_loans
           SET total_posted_deduction_paise = $1,
               remaining_balance_paise = $2,
               completed_instalments = $3,
               remaining_planned_instalments = GREATEST(0, repayment_months - $3),
               status = $4::varchar,
               last_processed_month = $5,
               last_processed_year = $6,
               completed_at = CASE WHEN $4::varchar = 'Completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            newTotalPostedPaise,
            newRemainingBalancePaise,
            newCompletedInstalments,
            newLoanStatus,
            numMonth,
            numYear,
            loan.id
          ]
        );

        // 3. Update Payroll Record
        if (payrollRecordId) {
          const actualDeductedRupees = toRupees(actualDeductedPaise);
          await client.query(
            `UPDATE payroll_records
             SET loan_deduction = $1,
                 loan_deduction_status = $2,
                 net_payable = GREATEST(0, (net_earning - staff_advance - professional_tax - tds - $1::numeric)),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [actualDeductedRupees, txStatus, payrollRecordId]
          );
        }

        await client.query('COMMIT');

        if (txStatus === 'Posted') totalPosted++;
        else if (txStatus === 'Partially Posted') totalPartiallyPosted++;
        else if (txStatus === 'Skipped') totalSkipped++;

      } catch (empErr) {
        await client.query('ROLLBACK');
        totalFailed++;
        console.error(`❌ Loan posting failed for loan ID ${loan.id}:`, empErr.message);
        failureDetails.push({
          loanId: loan.id,
          employeeCode: loan.employee_code,
          error: empErr.message
        });
      } finally {
        client.release();
      }
    }

    const batchStatus = totalFailed > 0 ? (totalProcessed === totalFailed ? 'Failed' : 'Completed with Errors') : 'Completed';

    await pool.query(
      `UPDATE loan_scheduler_batch_logs
       SET completed_at = CURRENT_TIMESTAMP,
           total_employees_checked = $1,
           total_loans_processed = $2,
           total_posted = $3,
           total_partially_posted = $4,
           total_skipped = $5,
           total_failed = $6,
           failure_details = $7,
           status = $8
       WHERE id = $9`,
      [
        totalChecked, totalProcessed, totalPosted, totalPartiallyPosted,
        totalSkipped, totalFailed, JSON.stringify(failureDetails), batchStatus, batchId
      ]
    );

    console.log(`🎉 Month-End Loan Processing finished for ${numMonth}/${numYear}. Posted: ${totalPosted}, Partial: ${totalPartiallyPosted}, Skipped: ${totalSkipped}, Failed: ${totalFailed}.`);

    return {
      success: true,
      batchId,
      totalChecked,
      totalProcessed,
      totalPosted,
      totalPartiallyPosted,
      totalSkipped,
      totalFailed,
      status: batchStatus
    };

  } catch (err) {
    console.error('❌ Error in processMonthEndLoanDeductions:', err.message);
    await pool.query(
      `UPDATE loan_scheduler_batch_logs
       SET completed_at = CURRENT_TIMESTAMP,
           total_failed = 1,
           failure_details = $1,
           status = 'Failed'
       WHERE id = $2`,
      [JSON.stringify([{ error: err.message }]), batchId]
    );
    return { success: false, error: err.message };
  }
}

/**
 * Daily 2:00 AM Cron Scheduler (Asia/Kolkata)
 * Checks if the previous calendar month's loan deductions need to be posted.
 */
function initLoanScheduler() {
  console.log('⏰ Initializing Interest-Free Loan Scheduler (Daily at 2:00 AM Asia/Kolkata)...');

  // Run at 02:00 AM every day
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('⏰ Running Daily Loan Scheduler Check...');

      // Calculate previous calendar month in Asia/Kolkata timezone
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      let prevMonth = now.getMonth(); // 0-11, so prev month is current getMonth()
      let prevYear = now.getFullYear();

      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }

      await processMonthEndLoanDeductions(prevMonth, prevYear);
    } catch (err) {
      console.error('❌ Scheduler error:', err);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });
}

module.exports = {
  toPaise,
  toRupees,
  calculateRepaymentSchedule,
  calculateRepaymentScheduleFlexible,
  getCalculatedLoanDeductionForEmployee,
  processMonthEndLoanDeductions,
  initLoanScheduler
};
