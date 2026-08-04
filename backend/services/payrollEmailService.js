const pool = require('../config/database');
const { sendEmail } = require('./emailService');
const { generateSinglePayslipBuffer } = require('../controllers/payrollController');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('./adminActivityService');

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

let tableInitialized = false;

/**
 * Ensure payroll_email_logs table exists and schema matches
 */
const ensurePayrollEmailLogsTable = async () => {
  if (tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payroll_email_logs (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(100) NOT NULL,
        employee_name VARCHAR(255),
        employee_email VARCHAR(255),
        payroll_id INTEGER NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        email_type VARCHAR(50) NOT NULL,
        subject TEXT,
        status VARCHAR(30) NOT NULL,
        provider VARCHAR(50) DEFAULT 'gmail_smtp',
        provider_message_id TEXT NULL,
        smtp_response TEXT NULL,
        accepted_recipients TEXT NULL,
        rejected_recipients TEXT NULL,
        error_message TEXT NULL,
        sent_by VARCHAR(100) NULL,
        sent_by_name VARCHAR(255) NULL,
        sent_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE payroll_email_logs
      ALTER COLUMN sent_by TYPE VARCHAR(100) USING sent_by::text;

      CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_employee_id ON payroll_email_logs(employee_id);
      CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_month_year ON payroll_email_logs(month, year);
      CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_status ON payroll_email_logs(status);
      CREATE INDEX IF NOT EXISTS idx_payroll_email_logs_email_type ON payroll_email_logs(email_type);
    `);
    tableInitialized = true;
  } catch (err) {
    console.warn('⚠️ Warning: ensurePayrollEmailLogsTable query notice:', err.message);
  }
};

/**
 * Log an email attempt into database (returns inserted log ID)
 */
const logPayrollEmail = async ({
  employeeId,
  employeeName,
  employeeEmail,
  payrollId = null,
  month,
  year,
  emailType = 'payslip',
  subject,
  status, // 'pending' | 'sent' | 'failed' | 'skipped'
  provider = 'gmail_smtp',
  providerMessageId = null,
  smtpResponse = null,
  acceptedRecipients = null,
  rejectedRecipients = null,
  errorMessage = null,
  sentBy = null,
  sentByName = null
}) => {
  await ensurePayrollEmailLogsTable();
  try {
    const acceptedStr = acceptedRecipients 
      ? (typeof acceptedRecipients === 'string' ? acceptedRecipients : JSON.stringify(acceptedRecipients))
      : null;
    const rejectedStr = rejectedRecipients 
      ? (typeof rejectedRecipients === 'string' ? rejectedRecipients : JSON.stringify(rejectedRecipients))
      : null;

    const safePayrollId = (payrollId && !isNaN(parseInt(payrollId))) ? parseInt(payrollId) : null;
    const safeMonth = (!month || isNaN(parseInt(month))) ? (new Date().getMonth() + 1) : parseInt(month);
    const safeYear = (!year || isNaN(parseInt(year))) ? new Date().getFullYear() : parseInt(year);
    const safeEmpId = String(employeeId || payrollId || 'N/A');
    const safeSentBy = sentBy ? String(sentBy) : null;

    const result = await pool.query(
      `INSERT INTO payroll_email_logs (
        employee_id, employee_name, employee_email, payroll_id, month, year,
        email_type, subject, status, provider, provider_message_id, smtp_response,
        accepted_recipients, rejected_recipients, error_message, sent_by, sent_by_name, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id`,
      [
        safeEmpId,
        employeeName || null,
        employeeEmail || null,
        safePayrollId,
        safeMonth,
        safeYear,
        emailType || 'payslip',
        subject || null,
        status || 'pending',
        provider || 'gmail_smtp',
        providerMessageId || null,
        smtpResponse || null,
        acceptedStr,
        rejectedStr,
        errorMessage || null,
        safeSentBy,
        sentByName || null,
        status === 'sent' ? new Date() : null
      ]
    );

    const logId = result.rows[0]?.id || null;
    console.log(`✅ Payroll email log saved (ID #${logId}) for employee ${safeEmpId} (${status})`);
    return logId;
  } catch (err) {
    console.error('❌ Failed to save payroll email log:', err.message);
    return null;
  }
};

/**
 * Update an existing payroll email log record status
 */
const updatePayrollEmailLog = async (logId, updates = {}) => {
  if (!logId) return;
  await ensurePayrollEmailLogsTable();
  try {
    const {
      status,
      provider_message_id,
      smtp_response,
      accepted_recipients,
      rejected_recipients,
      error_message,
      sent_at
    } = updates;

    const acceptedStr = accepted_recipients 
      ? (typeof accepted_recipients === 'string' ? accepted_recipients : JSON.stringify(accepted_recipients))
      : null;
    const rejectedStr = rejected_recipients 
      ? (typeof rejected_recipients === 'string' ? rejected_recipients : JSON.stringify(rejected_recipients))
      : null;

    await pool.query(
      `UPDATE payroll_email_logs
       SET status = COALESCE($1, status),
           provider_message_id = COALESCE($2, provider_message_id),
           smtp_response = COALESCE($3, smtp_response),
           accepted_recipients = COALESCE($4, accepted_recipients),
           rejected_recipients = COALESCE($5, rejected_recipients),
           error_message = COALESCE($6, error_message),
           sent_at = COALESCE($7, sent_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [
        status || null,
        provider_message_id || null,
        smtp_response || null,
        acceptedStr,
        rejectedStr,
        error_message || null,
        sent_at || null,
        logId
      ]
    );
  } catch (err) {
    console.error('❌ Failed to update payroll email log:', err.message);
  }
};

/**
 * Background worker job for sending single payslip email
 */
const processSinglePayslipEmailJob = async ({
  logId,
  record,
  monthNum,
  yearNum,
  monthName,
  recipientEmail,
  employeeName,
  empCode,
  subject,
  sent_by,
  sent_by_name,
  ipAddress
}) => {
  console.time(`single-email-total-${logId}`);
  try {
    // 1. Generate PDF Buffer (Signed Payslip)
    console.time(`single-email-pdf-${logId}`);
    const pdfBuffer = await generateSinglePayslipBuffer(record, monthNum, yearNum, { includeSignature: true });
    console.timeEnd(`single-email-pdf-${logId}`);

    // 2. Format Attachment
    const formattedMonthStr = String(monthNum).padStart(2, '0');
    const attachmentFilename = `payslip_${empCode}_${formattedMonthStr}_${yearNum}.pdf`;

    const html = `
<p>Dear <strong>${employeeName}</strong>,</p>
<p>Your payslip for <strong>${monthName} ${yearNum}</strong> has been generated.</p>
<p>Please find your payslip attached as a PDF file.</p>
<p>For any salary-related queries, please contact HR.</p>
<br/>
<p>Regards,<br/><strong>Manuscript Technomedia LLP</strong></p>
    `;

    const text = `Dear ${employeeName},\n\nYour payslip for ${monthName} ${yearNum} has been generated.\nPlease find your payslip attached as a PDF file.\n\nFor any salary-related queries, please contact HR.\n\nRegards,\nManuscript Technomedia LLP`;

    // 3. Send Email via Google SMTP Nodemailer
    console.time(`single-email-smtp-${logId}`);
    const sendResult = await sendEmail({
      toEmail: recipientEmail,
      toName: employeeName,
      subject,
      html,
      text,
      attachments: [
        {
          filename: attachmentFilename,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    });
    console.timeEnd(`single-email-smtp-${logId}`);

    // 4. Update Log Status to 'sent'
    console.time(`single-email-log-${logId}`);
    if (logId) {
      await updatePayrollEmailLog(logId, {
        status: "sent",
        provider_message_id: sendResult.messageId,
        smtp_response: sendResult.response,
        accepted_recipients: sendResult.accepted,
        rejected_recipients: sendResult.rejected,
        sent_at: new Date()
      });
    } else {
      console.warn(`⚠️ Log ID was missing for background job. Creating log entry directly...`);
      await logPayrollEmail({
        employeeId: empCode,
        employeeName,
        employeeEmail: recipientEmail,
        payrollId: record.id,
        month: monthNum,
        year: yearNum,
        subject,
        status: 'sent',
        provider: 'gmail_smtp',
        providerMessageId: sendResult.messageId,
        smtpResponse: sendResult.response,
        acceptedRecipients: sendResult.accepted,
        rejectedRecipients: sendResult.rejected,
        sentBy: sent_by,
        sentByName: sent_by_name
      });
    }

    if (sent_by) {
      await logAdminActivity({
        adminId: sent_by,
        adminName: sent_by_name || 'Admin',
        actionType: ADMIN_ACTION_TYPES.EXPORT_PAYROLL || 'Send Payslip Email',
        moduleName: MODULE_NAMES.PAYROLL || 'Payroll',
        description: `Sent payslip email for ${employeeName} (${empCode}) for ${monthName} ${yearNum} to ${recipientEmail}.`,
        ipAddress: ipAddress
      });
    }
    console.timeEnd(`single-email-log-${logId}`);
  } catch (err) {
    console.error(`❌ Single payslip background email job error for log #${logId}:`, err.message);
    let safeError = err.message || 'Email sending failed';
    if (safeError.includes("Invalid login") || safeError.includes("Username and Password not accepted")) {
      safeError = "Gmail SMTP authentication failed. Check SMTP_USER and Google App Password.";
    }

    if (logId) {
      await updatePayrollEmailLog(logId, {
        status: "failed",
        error_message: safeError,
        sent_at: new Date()
      });
    } else {
      await logPayrollEmail({
        employeeId: empCode,
        employeeName,
        employeeEmail: recipientEmail,
        payrollId: record.id,
        month: monthNum,
        year: yearNum,
        subject,
        status: 'failed',
        provider: 'gmail_smtp',
        errorMessage: safeError,
        sentBy: sent_by,
        sentByName: sent_by_name
      });
    }
  } finally {
    console.timeEnd(`single-email-total-${logId}`);
  }
};

/**
 * Send single payslip email (non-blocking background execution)
 */
const sendSinglePayslipEmail = async ({
  employee_id,
  payrollId = null,
  employeeId = null,
  employeeCode = null,
  month,
  year,
  sent_by = null,
  sent_by_name = null,
  ipAddress = null
}) => {
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  const monthName = MONTH_NAMES[monthNum - 1] || String(monthNum);
  const subject = `Payslip for ${monthName} ${yearNum} - Manuscript Technomedia LLP`;

  const searchEmpId = employee_id || employeeId || employeeCode;

  console.time("single-payslip-fetch");
  // 1. Fetch record from DB
  const result = await pool.query(
    `SELECT pr.*, 
            e.employee_id as emp_code_real, e.name as employee_name, e.job_role, e.email as emp_email,
            d.name as department_name
     FROM payroll_records pr
     LEFT JOIN employees e ON pr.employee_id::text = e.id::text OR pr.employee_code::text = e.employee_id::text OR pr.employee_id::text = e.employee_id::text
     LEFT JOIN departments d ON e.department_id = d.id
     WHERE (
            pr.id::text = $1 
         OR pr.employee_id::text = $1 
         OR pr.employee_code::text = $1 
         OR e.employee_id::text = $1 
         OR e.id::text = $1
         OR ($2::text IS NOT NULL AND (pr.employee_id::text = $2 OR pr.employee_code::text = $2 OR e.employee_id::text = $2 OR e.id::text = $2))
         OR ($3::text IS NOT NULL AND (pr.employee_id::text = $3 OR pr.employee_code::text = $3 OR e.employee_id::text = $3 OR e.id::text = $3))
       )
       AND pr.payroll_month = $4 AND pr.payroll_year = $5
     LIMIT 1`,
    [payrollId ? String(payrollId) : String(searchEmpId), employeeId ? String(employeeId) : null, employeeCode ? String(employeeCode) : null, monthNum, yearNum]
  );
  console.timeEnd("single-payslip-fetch");

  if (result.rows.length === 0) {
    const errorMsg = 'Payroll record not found for this employee.';
    await logPayrollEmail({
      employeeId: searchEmpId || payrollId,
      month: monthNum,
      year: yearNum,
      subject,
      status: 'skipped',
      provider: 'gmail_smtp',
      errorMessage: errorMsg,
      sentBy: sent_by,
      sentByName: sent_by_name
    });
    return { success: false, message: errorMsg };
  }

  const record = result.rows[0];
  let recipientEmail = record.emp_email || record.email;
  const employeeName = record.employee_name || record.name;
  const empCode = record.emp_code_real || record.employee_code || searchEmpId;

  // 1b. Fallback email lookup directly from employees table if missing on record
  if (!recipientEmail || !String(recipientEmail).trim() || !String(recipientEmail).includes('@')) {
    try {
      const empLookup = await pool.query(
        `SELECT email, name FROM employees 
         WHERE id::text = $1 OR employee_id::text = $1 OR employee_id::text = $2 OR id::text = $2
         LIMIT 1`,
        [String(record.employee_id || searchEmpId), String(record.employee_code || searchEmpId)]
      );
      if (empLookup.rows.length > 0 && empLookup.rows[0].email && String(empLookup.rows[0].email).includes('@')) {
        recipientEmail = empLookup.rows[0].email;
      }
    } catch (empErr) {
      console.warn('Fallback employee email lookup warning:', empErr.message);
    }
  }

  if (!recipientEmail || !String(recipientEmail).trim() || !String(recipientEmail).includes('@')) {
    const errorMsg = `Employee email is not available for ${employeeName || empCode}. Please update the employee email in Employee Management first.`;
    await logPayrollEmail({
      employeeId: empCode,
      employeeName,
      month: monthNum,
      year: yearNum,
      payrollId: record.id,
      subject,
      status: 'skipped',
      provider: 'gmail_smtp',
      errorMessage: errorMsg,
      sentBy: sent_by,
      sentByName: sent_by_name
    });
    return { success: false, message: errorMsg };
  }

  // 2. Insert Pending Email Log
  const pendingLogId = await logPayrollEmail({
    employeeId: empCode,
    employeeName,
    employeeEmail: recipientEmail,
    payrollId: record.id,
    month: monthNum,
    year: yearNum,
    subject,
    status: 'pending',
    provider: 'gmail_smtp',
    sentBy: sent_by,
    sentByName: sent_by_name
  });

  // 3. Dispatch Background Job
  setImmediate(() => {
    processSinglePayslipEmailJob({
      logId: pendingLogId,
      record,
      monthNum,
      yearNum,
      monthName,
      recipientEmail,
      employeeName,
      empCode,
      subject,
      sent_by,
      sent_by_name,
      ipAddress
    });
  });

  // 4. Return Immediate Response
  return {
    success: true,
    message: "Payslip email sending started. Check Email Logs for status.",
    logId: pendingLogId,
    status: "pending"
  };
};

/**
 * Send payslip emails to a selected list of employee_ids
 */
const sendSelectedPayslipEmails = async ({
  employee_ids = [],
  month,
  year,
  sent_by = null,
  sent_by_name = null,
  ipAddress = null
}) => {
  if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
    return { success: false, message: 'No employees selected.' };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const details = [];

  const BATCH_CONCURRENCY = 5;
  for (let i = 0; i < employee_ids.length; i += BATCH_CONCURRENCY) {
    const batch = employee_ids.slice(i, i + BATCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (empId) => {
        try {
          const res = await sendSinglePayslipEmail({
            employee_id: empId,
            month,
            year,
            sent_by,
            sent_by_name,
            ipAddress
          });
          return { empId, res };
        } catch (err) {
          return { empId, res: { success: false, message: err.message } };
        }
      })
    );

    for (const item of batchResults) {
      const empId = item.empId;
      const res = item.res;
      if (res.success) {
        sent++;
        details.push({ employee_id: empId, status: 'sent', message: res.message });
      } else if (res.message && (res.message.includes('missing') || res.message.includes('not found'))) {
        skipped++;
        details.push({ employee_id: empId, status: 'skipped', message: res.message });
      } else {
        failed++;
        details.push({ employee_id: empId, status: 'failed', message: res.message });
      }
    }
  }

  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  const monthName = MONTH_NAMES[monthNum - 1] || String(monthNum);

  if (sent_by && sent > 0) {
    await logAdminActivity({
      adminId: sent_by,
      adminName: sent_by_name || 'Admin',
      actionType: ADMIN_ACTION_TYPES.EXPORT_PAYROLL || 'Send Payslip Email',
      moduleName: MODULE_NAMES.PAYROLL || 'Payroll',
      description: `Sent batch payslip emails for ${monthName} ${yearNum}. Total selected: ${employee_ids.length}, Sent: ${sent}, Failed: ${failed}, Skipped: ${skipped}.`,
      ipAddress: ipAddress
    });
  }

  return {
    success: true,
    summary: {
      total: employee_ids.length,
      sent,
      failed,
      skipped
    },
    details
  };
};

/**
 * Send payslip emails to all employees who have a payroll record for month/year
 */
const sendAllPayslipsEmails = async ({
  month,
  year,
  sent_by = null,
  sent_by_name = null,
  ipAddress = null
}) => {
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);

  const result = await pool.query(
    `SELECT DISTINCT employee_code as emp_id
     FROM payroll_records
     WHERE payroll_month = $1 AND payroll_year = $2`,
    [monthNum, yearNum]
  );

  if (result.rows.length === 0) {
    return { success: false, message: `No payroll records found for ${monthNum}/${yearNum}. Please calculate payroll first.` };
  }

  const allEmpIds = result.rows.map(r => r.emp_id);
  return await sendSelectedPayslipEmails({
    employee_ids: allEmpIds,
    month: monthNum,
    year: yearNum,
    sent_by,
    sent_by_name,
    ipAddress
  });
};

/**
 * Get payroll email logs for a specific month and year
 */
const getPayrollEmailLogs = async (month, year) => {
  await ensurePayrollEmailLogsTable();
  let monthNum = parseInt(month);
  let yearNum = parseInt(year);

  if (isNaN(monthNum)) monthNum = new Date().getMonth() + 1;
  if (isNaN(yearNum)) yearNum = new Date().getFullYear();

  const result = await pool.query(
    `SELECT * FROM payroll_email_logs
     WHERE month = $1 AND year = $2
     ORDER BY created_at DESC`,
    [monthNum, yearNum]
  );

  return result.rows;
};

module.exports = {
  sendSinglePayslipEmail,
  sendSelectedPayslipEmails,
  sendAllPayslipsEmails,
  getPayrollEmailLogs
};
