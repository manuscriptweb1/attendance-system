const pool = require('../config/database');
const exceljs = require('exceljs');
const {
  toPaise,
  toRupees,
  calculateRepaymentSchedule,
  calculateRepaymentScheduleFlexible,
  processMonthEndLoanDeductions
} = require('../services/loanSchedulerService');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');

/**
 * Map employee loan DB record to frontend model
 */
function mapLoanRecord(r) {
  const totalAmount = toRupees(r.total_loan_amount_paise);
  const monthlyDeduction = toRupees(r.monthly_scheduled_deduction_paise);
  const totalDeducted = toRupees(r.total_posted_deduction_paise);
  const remainingBalance = toRupees(r.remaining_balance_paise);

  return {
    id: r.id,
    loanCode: r.loan_code,
    employeeId: r.employee_db_id || r.employee_id,
    employeeCode: r.employee_code,
    employeeName: r.employee_name || r.name,
    department: r.department_name || r.department || 'N/A',
    calculationMode: r.calculation_mode || 'by_months',
    totalLoanAmount: totalAmount,
    totalLoanAmountPaise: parseInt(r.total_loan_amount_paise),
    repaymentMonths: r.repayment_months,
    monthlyScheduledDeduction: monthlyDeduction,
    monthlyScheduledDeductionPaise: parseInt(r.monthly_scheduled_deduction_paise),
    totalPostedDeduction: totalDeducted,
    totalPostedDeductionPaise: parseInt(r.total_posted_deduction_paise),
    remainingBalance: remainingBalance,
    remainingBalancePaise: parseInt(r.remaining_balance_paise),
    loanIssueDate: r.loan_issue_date,
    firstDeductionMonth: r.first_deduction_month,
    firstDeductionYear: r.first_deduction_year,
    expectedCompletionMonth: r.expected_completion_month,
    expectedCompletionYear: r.expected_completion_year,
    completedInstalments: r.completed_instalments,
    remainingPlannedInstalments: r.remaining_planned_instalments,
    status: r.status,
    remarks: r.remarks,
    cancellationReason: r.cancellation_reason,
    lastProcessedMonth: r.last_processed_month,
    lastProcessedYear: r.last_processed_year,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at
  };
}

/**
 * Preview Repayment Schedule
 */
const previewRepaymentSchedule = async (req, res) => {
  try {
    const {
      totalAmount,
      calculationMode = 'by_months',
      repaymentMonths,
      monthlyDeduction,
      firstDeductionMonth,
      firstDeductionYear
    } = req.body;

    const amount = parseFloat(totalAmount);
    const startMonth = parseInt(firstDeductionMonth);
    const startYear = parseInt(firstDeductionYear);
    const mode = calculationMode === 'by_emi' ? 'by_emi' : 'by_months';

    if (!amount || amount <= 0 || isNaN(amount)) {
      return res.status(400).json({ success: false, message: 'Total loan amount must be greater than 0' });
    }

    let months = parseInt(repaymentMonths) || 1;
    let monthlyEmi = parseFloat(monthlyDeduction) || 0;

    if (mode === 'by_emi') {
      if (!monthlyEmi || monthlyEmi <= 0 || isNaN(monthlyEmi)) {
        return res.status(400).json({ success: false, message: 'Monthly deduction must be greater than 0' });
      }
      if (monthlyEmi > amount) {
        return res.status(400).json({ success: false, message: 'Monthly deduction cannot exceed total loan amount' });
      }
    } else {
      if (!months || months <= 0 || !Number.isInteger(months)) {
        return res.status(400).json({ success: false, message: 'Repayment months must be a positive whole number' });
      }
      if (months > 120) {
        return res.status(400).json({ success: false, message: 'Repayment months cannot exceed 120' });
      }
    }

    if (!startMonth || startMonth < 1 || startMonth > 12) {
      return res.status(400).json({ success: false, message: 'Valid first deduction month required' });
    }
    if (!startYear || startYear < 2020) {
      return res.status(400).json({ success: false, message: 'Valid first deduction year required' });
    }

    const scheduleData = calculateRepaymentScheduleFlexible({
      totalAmountRupees: amount,
      calculationMode: mode,
      durationMonths: months,
      monthlyEMIRupees: monthlyEmi,
      startMonth,
      startYear
    });

    return res.json({ success: true, ...scheduleData });
  } catch (err) {
    console.error('Preview repayment schedule error:', err);
    res.status(500).json({ success: false, message: 'Server error calculating schedule' });
  }
};

/**
 * Create Employee Loan
 */
const createLoan = async (req, res) => {
  try {
    const {
      employeeId,
      totalAmount,
      calculationMode = 'by_months',
      repaymentMonths,
      monthlyDeduction,
      firstDeductionMonth,
      firstDeductionYear,
      loanIssueDate,
      remarks
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee is required' });
    }

    const amount = parseFloat(totalAmount);
    const startMonth = parseInt(firstDeductionMonth);
    const startYear = parseInt(firstDeductionYear);
    const mode = calculationMode === 'by_emi' ? 'by_emi' : 'by_months';

    if (!amount || amount <= 0 || isNaN(amount)) {
      return res.status(400).json({ success: false, message: 'Total loan amount must be greater than 0' });
    }

    let months = parseInt(repaymentMonths) || 1;
    let monthlyEmi = parseFloat(monthlyDeduction) || 0;

    if (mode === 'by_emi') {
      if (!monthlyEmi || monthlyEmi <= 0 || isNaN(monthlyEmi)) {
        return res.status(400).json({ success: false, message: 'Monthly deduction must be greater than 0' });
      }
      if (monthlyEmi > amount) {
        return res.status(400).json({ success: false, message: 'Monthly deduction cannot exceed total loan amount' });
      }
    } else {
      if (!months || months <= 0 || !Number.isInteger(months)) {
        return res.status(400).json({ success: false, message: 'Repayment months must be a positive whole number' });
      }
      if (months > 120) {
        return res.status(400).json({ success: false, message: 'Repayment months cannot exceed 120' });
      }
    }

    // Verify employee exists
    const empRes = await pool.query(
      `SELECT id, employee_id, name FROM employees WHERE id::text = $1 OR employee_id::text = $1 LIMIT 1`,
      [String(employeeId)]
    );

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const emp = empRes.rows[0];
    const empDbId = emp.id;
    const empCode = emp.employee_id;

    // Check for existing active/scheduled loan for this employee
    const activeCheck = await pool.query(
      `SELECT id, loan_code FROM employee_loans
       WHERE (employee_id = $1 OR employee_code = $2)
         AND status IN ('Scheduled', 'Active')
         AND remaining_balance_paise > 0`,
      [empDbId, empCode]
    );

    if (activeCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Employee already has an active loan (${activeCheck.rows[0].loan_code}). Please complete or cancel the existing loan first.`
      });
    }

    const scheduleData = calculateRepaymentScheduleFlexible({
      totalAmountRupees: amount,
      calculationMode: mode,
      durationMonths: months,
      monthlyEMIRupees: monthlyEmi,
      startMonth,
      startYear
    });

    const finalMonths = scheduleData.repaymentMonths;
    const issueDate = loanIssueDate ? new Date(loanIssueDate) : new Date();

    const loanCode = `LOAN-${String(Date.now()).slice(-6)}`;

    // Determine initial status: Scheduled if first deduction is in future month/year, else Active
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let initialStatus = 'Active';
    if (startYear > currentYear || (startYear === currentYear && startMonth > currentMonth)) {
      initialStatus = 'Scheduled';
    }

    const insertRes = await pool.query(
      `INSERT INTO employee_loans (
         loan_code, employee_id, employee_code,
         total_loan_amount_paise, repayment_months, monthly_scheduled_deduction_paise,
         total_posted_deduction_paise, remaining_balance_paise,
         loan_issue_date, first_deduction_month, first_deduction_year,
         expected_completion_month, expected_completion_year,
         completed_instalments, remaining_planned_instalments,
         status, remarks, created_by, calculation_mode
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6,
         0, $4,
         $7, $8, $9,
         $10, $11,
         0, $5,
         $12, $13, $14, $15
       ) RETURNING *`,
      [
        loanCode, empDbId, empCode,
        scheduleData.totalPaise, finalMonths, scheduleData.monthlyScheduledDeductionPaise,
        issueDate, startMonth, startYear,
        scheduleData.expectedCompletionMonth, scheduleData.expectedCompletionYear,
        initialStatus, remarks || null, (Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null), mode
      ]
    );

    const newLoan = insertRes.rows[0];

    await logAdminActivity({
      adminId: req.user?.id,
      adminName: req.user?.username || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: ADMIN_ACTION_TYPES.CREATE_LOAN || 'Create Loan',
      moduleName: MODULE_NAMES.PAYROLL || 'Payroll',
      description: `Created interest-free loan ${loanCode} of ₹${amount.toLocaleString('en-IN')} for ${emp.name} (${empCode}). Repayment: ${months} months.`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Employee loan created successfully', loan: mapLoanRecord(newLoan) });

  } catch (err) {
    console.error('Create loan error:', err);
    res.status(500).json({ success: false, message: 'Server error creating loan' });
  }
};

/**
 * Get All Loans with filters & pagination
 */
const getAllLoans = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = `WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      whereClause += ` AND el.status = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClause += ` AND (LOWER(el.loan_code) LIKE $${params.length} OR LOWER(el.employee_code) LIKE $${params.length} OR LOWER(e.name) LIKE $${params.length} OR LOWER(e.email) LIKE $${params.length})`;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM employee_loans el
       JOIN employees e ON el.employee_id::text = e.id::text OR el.employee_code::text = e.employee_id::text
       ${whereClause}`,
      params
    );

    const totalCount = parseInt(countRes.rows[0].count);

    const queryParams = [...params, parseInt(limit), offset];
    const loansRes = await pool.query(
      `SELECT el.*, e.id as employee_db_id, e.name as employee_name, d.name as department_name
       FROM employee_loans el
       JOIN employees e ON el.employee_id::text = e.id::text OR el.employee_code::text = e.employee_id::text
       LEFT JOIN departments d ON e.department_id = d.id
       ${whereClause}
       ORDER BY el.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      queryParams
    );

    res.json({
      success: true,
      loans: loansRes.rows.map(mapLoanRecord),
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (err) {
    console.error('Get all loans error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching loans' });
  }
};

/**
 * Get Loan Summary Cards
 */
const getLoanSummary = async (req, res) => {
  try {
    const summaryRes = await pool.query(`
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN status = 'Scheduled' THEN 1 END) as scheduled_loans,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_loans,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_loans,
        COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled_loans,
        COALESCE(SUM(total_loan_amount_paise), 0) as total_loan_amount_paise
      FROM employee_loans
    `);

    const summary = summaryRes.rows[0];

    // Total Repaid = sum of ONLY valid Posted or Partially Posted repayment transactions
    const postedRes = await pool.query(`
      SELECT COALESCE(SUM(actual_deducted_paise), 0) as total_posted_paise
      FROM loan_repayment_transactions
      WHERE status IN ('Posted', 'Partially Posted')
    `);

    const totalLoanAmountPaise = parseInt(summary.total_loan_amount_paise) || 0;
    const totalPostedPaise = parseInt(postedRes.rows[0].total_posted_paise) || 0;
    const totalOutstandingBalancePaise = Math.max(0, totalLoanAmountPaise - totalPostedPaise);

    // Current month pending calculation total (Asia/Kolkata timezone)
    const nowKolkata = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentMonth = nowKolkata.getMonth() + 1;
    const currentYear = nowKolkata.getFullYear();

    const pendingRes = await pool.query(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN remaining_balance_paise < monthly_scheduled_deduction_paise THEN remaining_balance_paise
          ELSE monthly_scheduled_deduction_paise
        END
      ), 0) as current_pending_paise
      FROM employee_loans
      WHERE status IN ('Active', 'Scheduled')
        AND (first_deduction_year < $1 OR (first_deduction_year = $1 AND first_deduction_month <= $2))
        AND remaining_balance_paise > 0
    `, [currentYear, currentMonth]);

    // Previous month posted total
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const prevPostedRes = await pool.query(`
      SELECT COALESCE(SUM(actual_deducted_paise), 0) as prev_posted_paise
      FROM loan_repayment_transactions
      WHERE payroll_month = $1 AND payroll_year = $2 AND status IN ('Posted', 'Partially Posted')
    `, [prevMonth, prevYear]);

    // Check last batch log for any failures
    const lastBatchRes = await pool.query(`
      SELECT * FROM loan_scheduler_batch_logs
      ORDER BY id DESC LIMIT 1
    `);

    const lastBatch = lastBatchRes.rows[0] || null;

    res.json({
      success: true,
      summary: {
        totalLoans: parseInt(summary.total_loans),
        scheduledLoans: parseInt(summary.scheduled_loans),
        activeLoans: parseInt(summary.active_loans),
        completedLoans: parseInt(summary.completed_loans),
        cancelledLoans: parseInt(summary.cancelled_loans),
        totalLoanAmount: toRupees(totalLoanAmountPaise),
        totalDeductedAmount: toRupees(totalPostedPaise),
        totalOutstandingBalance: toRupees(totalOutstandingBalancePaise),
        currentMonthPendingDeduction: toRupees(pendingRes.rows[0].current_pending_paise),
        previousMonthPostedDeduction: toRupees(prevPostedRes.rows[0].prev_posted_paise),
        lastBatchStatus: lastBatch ? lastBatch.status : null,
        lastBatchErrors: lastBatch && ['Failed', 'Completed with Errors'].includes(lastBatch.status)
      }
    });

  } catch (err) {
    console.error('Get loan summary error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching loan summary' });
  }
};

/**
 * Get Single Loan Details
 */
const getLoanById = async (req, res) => {
  try {
    const { id } = req.params;
    const loanRes = await pool.query(
      `SELECT el.*, e.id as employee_db_id, e.name as employee_name, d.name as department_name
       FROM employee_loans el
       JOIN employees e ON el.employee_id::text = e.id::text OR el.employee_code::text = e.employee_id::text
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE el.id = $1`,
      [id]
    );

    if (loanRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan record not found' });
    }

    res.json({ success: true, loan: mapLoanRecord(loanRes.rows[0]) });
  } catch (err) {
    console.error('Get loan by ID error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Get Loan Repayment History Transactions
 */
const getRepaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const txRes = await pool.query(
      `SELECT lrt.*, a.username as reversed_by_name
       FROM loan_repayment_transactions lrt
       LEFT JOIN admins a ON lrt.reversal_by = a.id
       WHERE lrt.loan_id = $1
       ORDER BY lrt.payroll_year DESC, lrt.payroll_month DESC, lrt.id DESC`,
      [id]
    );

    const formattedTx = txRes.rows.map(t => ({
      id: t.id,
      transactionCode: t.transaction_code,
      loanId: t.loan_id,
      employeeId: t.employee_id,
      payrollRecordId: t.payroll_record_id,
      payrollMonth: t.payroll_month,
      payrollYear: t.payroll_year,
      scheduledDeduction: toRupees(t.scheduled_deduction_paise),
      actualDeducted: toRupees(t.actual_deducted_paise),
      shortfall: toRupees(t.shortfall_paise),
      balanceBefore: toRupees(t.balance_before_paise),
      balanceAfter: toRupees(t.balance_after_paise),
      postingDate: t.posting_date,
      status: t.status,
      createdBySystem: t.created_by_system,
      reversalDate: t.reversal_date,
      reversalReason: t.reversal_reason,
      reversedByName: t.reversed_by_name
    }));

    res.json({ success: true, history: formattedTx });
  } catch (err) {
    console.error('Get repayment history error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Edit Permitted Loan Details (Full edit before deductions start, remarks update after)
 */
const updateLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      totalAmount,
      repaymentMonths,
      firstDeductionMonth,
      firstDeductionYear,
      loanIssueDate,
      remarks
    } = req.body;

    const loanRes = await pool.query(`SELECT * FROM employee_loans WHERE id = $1`, [id]);
    if (loanRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan record not found' });
    }

    const loan = loanRes.rows[0];
    if (['Completed', 'Cancelled'].includes(loan.status)) {
      return res.status(400).json({ success: false, message: `Cannot edit a ${loan.status.toLowerCase()} loan` });
    }

    const hasPostedDeductions = parseInt(loan.total_posted_deduction_paise) > 0 || loan.completed_instalments > 0;

    let updateRes;

    if (hasPostedDeductions) {
      // Only allow updating non-financial remarks
      updateRes = await pool.query(
        `UPDATE employee_loans
         SET remarks = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [remarks || loan.remarks, id]
      );
    } else {
      // Deductions haven't started: allow full update of financial terms
      const { calculationMode = loan.calculation_mode || 'by_months', monthlyDeduction } = req.body;
      const mode = calculationMode === 'by_emi' ? 'by_emi' : 'by_months';

      const amount = totalAmount ? parseFloat(totalAmount) : toRupees(loan.total_loan_amount_paise);
      const months = repaymentMonths ? parseInt(repaymentMonths) : loan.repayment_months;
      const monthlyEmi = monthlyDeduction ? parseFloat(monthlyDeduction) : toRupees(loan.monthly_scheduled_deduction_paise);
      const startMonth = firstDeductionMonth ? parseInt(firstDeductionMonth) : loan.first_deduction_month;
      const startYear = firstDeductionYear ? parseInt(firstDeductionYear) : loan.first_deduction_year;

      if (!amount || amount <= 0 || isNaN(amount)) {
        return res.status(400).json({ success: false, message: 'Total loan amount must be greater than 0' });
      }

      if (mode === 'by_emi') {
        if (!monthlyEmi || monthlyEmi <= 0 || isNaN(monthlyEmi)) {
          return res.status(400).json({ success: false, message: 'Monthly deduction must be greater than 0' });
        }
        if (monthlyEmi > amount) {
          return res.status(400).json({ success: false, message: 'Monthly deduction cannot exceed total loan amount' });
        }
      } else {
        if (!months || months <= 0 || !Number.isInteger(months)) {
          return res.status(400).json({ success: false, message: 'Repayment months must be a positive whole number' });
        }
        if (months > 120) {
          return res.status(400).json({ success: false, message: 'Repayment months cannot exceed 120' });
        }
      }

      const scheduleData = calculateRepaymentScheduleFlexible({
        totalAmountRupees: amount,
        calculationMode: mode,
        durationMonths: months,
        monthlyEMIRupees: monthlyEmi,
        startMonth,
        startYear
      });

      const finalMonths = scheduleData.repaymentMonths;
      const issueDate = loanIssueDate ? new Date(loanIssueDate) : loan.loan_issue_date;

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      let newStatus = loan.status;
      if (startYear > currentYear || (startYear === currentYear && startMonth > currentMonth)) {
        newStatus = 'Scheduled';
      } else {
        newStatus = 'Active';
      }

      updateRes = await pool.query(
        `UPDATE employee_loans
         SET total_loan_amount_paise = $1,
             repayment_months = $2,
             monthly_scheduled_deduction_paise = $3,
             remaining_balance_paise = $1,
             loan_issue_date = $4,
             first_deduction_month = $5,
             first_deduction_year = $6,
             expected_completion_month = $7,
             expected_completion_year = $8,
             remaining_planned_instalments = $2,
             status = $9,
             remarks = $10,
             calculation_mode = $11,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $12 RETURNING *`,
        [
          scheduleData.totalPaise,
          finalMonths,
          scheduleData.monthlyScheduledDeductionPaise,
          issueDate,
          startMonth,
          startYear,
          scheduleData.expectedCompletionMonth,
          scheduleData.expectedCompletionYear,
          newStatus,
          remarks || loan.remarks || null,
          mode,
          id
        ]
      );
    }

    const updatedRecord = updateRes.rows[0];

    await logAdminActivity({
      adminId: req.user?.id,
      adminName: req.user?.username || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'UPDATE_LOAN',
      moduleName: MODULE_NAMES.PAYROLL || 'Payroll',
      description: `Updated interest-free loan ${updatedRecord.loan_code} for employee ${updatedRecord.employee_code}.`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Loan updated successfully', loan: mapLoanRecord(updatedRecord) });

  } catch (err) {
    console.error('Update loan error:', err);
    res.status(500).json({ success: false, message: 'Server error updating loan' });
  }
};

/**
 * Cancel Loan
 */
const cancelLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    if (!cancellationReason || !cancellationReason.trim()) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    }

    const loanRes = await pool.query(`SELECT * FROM employee_loans WHERE id = $1`, [id]);
    if (loanRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    const loan = loanRes.rows[0];
    if (loan.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Loan is already cancelled' });
    }
    if (loan.status === 'Completed') {
      return res.status(400).json({ success: false, message: 'Completed loan cannot be cancelled' });
    }

    const updateRes = await pool.query(
      `UPDATE employee_loans
       SET status = 'Cancelled',
           cancellation_reason = $1,
           cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [cancellationReason.trim(), id]
    );

    await logAdminActivity({
      adminId: req.user?.id,
      adminName: req.user?.username || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: ADMIN_ACTION_TYPES.CANCEL_LOAN || 'Cancel Loan',
      moduleName: MODULE_NAMES.PAYROLL || 'Payroll',
      description: `Cancelled loan ${loan.loan_code} for employee ${loan.employee_code}. Reason: ${cancellationReason}`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Loan cancelled successfully', loan: mapLoanRecord(updateRes.rows[0]) });

  } catch (err) {
    console.error('Cancel loan error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Delete Unused Loan (only if no posted deductions exist)
 */
const deleteLoan = async (req, res) => {
  try {
    const { id } = req.params;

    const loanRes = await pool.query(`SELECT * FROM employee_loans WHERE id = $1`, [id]);
    if (loanRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    const loan = loanRes.rows[0];
    if (parseInt(loan.total_posted_deduction_paise) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a loan that has posted repayments. You may cancel it instead.'
      });
    }

    await pool.query(`DELETE FROM employee_loans WHERE id = $1`, [id]);

    await logAdminActivity({
      adminId: req.user?.id,
      adminName: req.user?.username || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'DELETE_LOAN',
      moduleName: MODULE_NAMES.PAYROLL || 'Payroll',
      description: `Deleted unused loan ${loan.loan_code} for employee ${loan.employee_code}.`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Unused loan deleted successfully' });

  } catch (err) {
    console.error('Delete loan error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Authorised Reversal of a Posted Loan Deduction
 */
const reverseTransaction = async (req, res) => {
  const client = await pool.connect();
  try {
    const { transactionId, reversalReason } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }
    if (!reversalReason || !reversalReason.trim()) {
      return res.status(400).json({ success: false, message: 'Reversal reason is required' });
    }

    await client.query('BEGIN');

    const txRes = await client.query(
      `SELECT * FROM loan_repayment_transactions WHERE id = $1 FOR UPDATE`,
      [transactionId]
    );

    if (txRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Repayment transaction not found' });
    }

    const tx = txRes.rows[0];
    if (tx.status === 'Reversed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Transaction is already reversed' });
    }

    const deductedPaise = parseInt(tx.actual_deducted_paise);

    // Fetch loan record
    const loanRes = await client.query(
      `SELECT * FROM employee_loans WHERE id = $1 FOR UPDATE`,
      [tx.loan_id]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Associated loan not found' });
    }

    const loan = loanRes.rows[0];

    const newTotalPostedPaise = Math.max(0, parseInt(loan.total_posted_deduction_paise) - deductedPaise);
    const newRemainingBalancePaise = parseInt(loan.remaining_balance_paise) + deductedPaise;

    let newCompletedInstalments = Math.max(0, loan.completed_instalments - (deductedPaise > 0 ? 1 : 0));
    let newStatus = loan.status;

    if (newRemainingBalancePaise > 0 && loan.status === 'Completed') {
      newStatus = 'Active';
    }

    // 1. Mark transaction as Reversed
    const numericReversalAdminId = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;
    await client.query(
      `UPDATE loan_repayment_transactions
       SET status = 'Reversed',
           reversal_date = CURRENT_TIMESTAMP,
           reversal_reason = $1,
           reversal_by = $2
       WHERE id = $3`,
      [reversalReason.trim(), numericReversalAdminId, transactionId]
    );

    // 2. Update Employee Loan
    await client.query(
      `UPDATE employee_loans
       SET total_posted_deduction_paise = $1,
           remaining_balance_paise = $2,
           completed_instalments = $3,
           remaining_planned_instalments = GREATEST(0, repayment_months - $3),
           status = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [newTotalPostedPaise, newRemainingBalancePaise, newCompletedInstalments, newStatus, loan.id]
    );

    // 3. Update Payroll Record if linked
    if (tx.payroll_record_id) {
      await client.query(
        `UPDATE payroll_records
         SET loan_deduction = 0,
             loan_deduction_status = 'Reversed',
             net_payable = (net_earning - staff_advance - professional_tax - tds),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [tx.payroll_record_id]
      );
    }

    await client.query('COMMIT');

    await logAdminActivity({
      adminId: req.user?.id,
      adminName: req.user?.username || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'REVERSE_LOAN_TRANSACTION',
      moduleName: MODULE_NAMES.PAYROLL || 'Payroll',
      description: `Reversed loan deduction of ₹${toRupees(deductedPaise)} for loan ${loan.loan_code} (${tx.payroll_month}/${tx.payroll_year}). Reason: ${reversalReason}`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Repayment transaction reversed successfully' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reverse transaction error:', err);
    res.status(500).json({ success: false, message: 'Server error reversing transaction' });
  } finally {
    client.release();
  }
};

/**
 * Manual Month-End Scheduler Trigger (For Testing/Manual Admin Trigger)
 */
const triggerMonthEndProcessing = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year are required' });
    }

    const result = await processMonthEndLoanDeductions(month, year, req.user?.id);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message || 'Processing rejected', result });
    }
    res.json({ success: true, message: 'Month-end loan processing completed successfully', result });
  } catch (err) {
    console.error('Trigger month end processing error:', err);
    res.status(500).json({ success: false, message: 'Server error running processing' });
  }
};

/**
 * Export Loan Reports (Excel)
 */
const exportLoansExcel = async (req, res) => {
  try {
    const { reportType = 'master', status } = req.query;

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Employee Loans');

    let whereClause = `WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      whereClause += ` AND el.status = $${params.length}`;
    }

    if (reportType === 'outstanding') {
      whereClause += ` AND el.status IN ('Active', 'Scheduled') AND el.remaining_balance_paise > 0`;
    } else if (reportType === 'completed') {
      whereClause += ` AND el.status = 'Completed'`;
    }

    const loansRes = await pool.query(
      `SELECT el.*, e.name as employee_name, d.name as department_name
       FROM employee_loans el
       JOIN employees e ON el.employee_id::text = e.id::text OR el.employee_code::text = e.employee_id::text
       LEFT JOIN departments d ON e.department_id = d.id
       ${whereClause}
       ORDER BY el.created_at DESC`,
      params
    );

    worksheet.columns = [
      { header: 'Loan Code', key: 'loanCode', width: 16 },
      { header: 'Emp Code', key: 'empCode', width: 14 },
      { header: 'Employee Name', key: 'empName', width: 24 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Total Loan (₹)', key: 'totalAmount', width: 16 },
      { header: 'Repayment Months', key: 'months', width: 18 },
      { header: 'Monthly Deduction (₹)', key: 'monthlyDeduction', width: 22 },
      { header: 'Total Deducted (₹)', key: 'totalDeducted', width: 18 },
      { header: 'Remaining Balance (₹)', key: 'remainingBalance', width: 22 },
      { header: 'Completed Instalments', key: 'completedInstalments', width: 22 },
      { header: 'First Deduction', key: 'firstDeduction', width: 16 },
      { header: 'Expected Completion', key: 'expectedCompletion', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Remarks', key: 'remarks', width: 30 }
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    loansRes.rows.forEach(r => {
      const loan = mapLoanRecord(r);
      const row = worksheet.addRow({
        loanCode: loan.loanCode,
        empCode: loan.employeeCode,
        empName: loan.employeeName,
        department: loan.department,
        totalAmount: loan.totalLoanAmount,
        months: loan.repaymentMonths,
        monthlyDeduction: loan.monthlyScheduledDeduction,
        totalDeducted: loan.totalPostedDeduction,
        remainingBalance: loan.remainingBalance,
        completedInstalments: `${loan.completedInstalments} / ${loan.repaymentMonths}`,
        firstDeduction: `${String(loan.firstDeductionMonth).padStart(2, '0')}/${loan.firstDeductionYear}`,
        expectedCompletion: `${String(loan.expectedCompletionMonth).padStart(2, '0')}/${loan.expectedCompletionYear}`,
        status: loan.status,
        remarks: loan.remarks || '-'
      });
      row.alignment = { vertical: 'middle' };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=employee_loans_${reportType}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Export loans excel error:', err);
    res.status(500).json({ success: false, message: 'Server error exporting excel' });
  }
};

module.exports = {
  previewRepaymentSchedule,
  createLoan,
  getAllLoans,
  getLoanSummary,
  getLoanById,
  getRepaymentHistory,
  updateLoan,
  cancelLoan,
  deleteLoan,
  reverseTransaction,
  triggerMonthEndProcessing,
  exportLoansExcel
};
