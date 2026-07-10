const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

/**
 * Clear employee audit logs (security logs)
 */
const clearEmployeeAuditLogs = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM audit_logs WHERE user_type = $1', ['employee']);
    
    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: 'Clear Employee Audit Logs',
      moduleName: MODULE_NAMES.SECURITY,
      description: `Cleared all employee audit logs (${result.rowCount} records deleted)`,
      oldData: { recordsDeleted: result.rowCount },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `Successfully cleared ${result.rowCount} employee audit log records`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Clear employee audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear employee audit logs'
    });
  }
};

/**
 * Clear admin activity logs
 */
const clearAdminActivityLogs = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM admin_activity_logs');
    
    // Note: We can't log this deletion to admin_activity_logs since we just deleted everything
    // But we log to audit_logs for tracking
    const { logAudit, AUDIT_STATUS } = require('../services/auditService');
    await logAudit({
      userId: req.user.username,
      userType: 'admin',
      action: 'clear_admin_activity_logs',
      status: AUDIT_STATUS.SUCCESS,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
      details: { recordsDeleted: result.rowCount }
    });

    res.json({
      success: true,
      message: `Successfully cleared ${result.rowCount} admin activity log records`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Clear admin activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear admin activity logs'
    });
  }
};

/**
 * Clear attendance records for specific month/year
 */
const clearMonthlyAttendance = async (req, res) => {
  try {
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required'
      });
    }

    // Validate year and month
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (yearNum < 2000 || yearNum > 2100 || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month'
      });
    }

    // Delete attendance for the specified month
    const result = await pool.query(
      `DELETE FROM attendance 
       WHERE EXTRACT(YEAR FROM attendance_date) = $1 
       AND EXTRACT(MONTH FROM attendance_date) = $2`,
      [yearNum, monthNum]
    );

    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: 'Clear Monthly Attendance',
      moduleName: MODULE_NAMES.ATTENDANCE,
      description: `Cleared attendance records for ${month}/${year} (${result.rowCount} records deleted)`,
      oldData: { year: yearNum, month: monthNum, recordsDeleted: result.rowCount },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `Successfully cleared ${result.rowCount} attendance records for ${month}/${year}`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Clear monthly attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear attendance records'
    });
  }
};

const clearDataByDate = async (req, res) => {
  try {
    const { module, fromDate, toDate, confirmation } = req.body;
    
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Invalid confirmation string' });
    }
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'From Date and To Date are required' });
    }
    
    if (new Date(toDate) < new Date(fromDate)) {
      return res.status(400).json({ success: false, message: 'To Date cannot be before From Date' });
    }
    
    const tableConfig = {
      attendance: { table: 'attendance', dateCol: 'attendance_date' },
      manual_attendance: { table: 'manual_attendance_logs', dateCol: 'created_at' },
      holidays: { table: 'holidays', dateCol: 'holiday_date' },
      payroll: { table: 'payroll_records', dateCol: 'created_at' },
      expenses: { table: 'monthly_expenses', dateCol: 'expense_date' },
      reports: { table: 'report_snapshots', dateCol: 'generated_at' },
      activity_logs: { table: 'admin_activity_logs', dateCol: 'created_at' },
      security_logs: { table: 'audit_logs', dateCol: 'created_at' },
      employees: { table: 'employees', dateCol: 'created_at' },
      departments: { table: 'departments', dateCol: 'created_at' },
      assign_work: { table: 'works', dateCol: 'created_at' },
      workflow_templates: { table: 'workflow_templates', dateCol: 'created_at' },
      work_pipeline: { table: 'works', dateCol: 'created_at' },
      work_monitoring: { table: 'works', dateCol: 'created_at' },
      hold_works: { table: 'works', dateCol: 'created_at' },
      completed_works: { table: 'works', dateCol: 'created_at' },
      admin_management: { table: 'admins', dateCol: 'created_at' }
    };

    const config = tableConfig[module];
    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid module for clear operation' });
    }

    const { table, dateCol } = config;
    const toDateEnd = `${toDate} 23:59:59`;

    const result = await pool.query(
      `DELETE FROM ${table} WHERE ${dateCol} >= $1 AND ${dateCol} <= $2`,
      [fromDate, toDateEnd]
    );

    // Log admin activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: `Clear ${module} Data`,
      moduleName: MODULE_NAMES.ADMIN || module,
      description: `Cleared ${result.rowCount} records from ${table} between ${fromDate} and ${toDate}`,
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `Successfully cleared ${result.rowCount} records.`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error(`Clear data error for ${req.body?.module}:`, error);
    if (error.code === '42P01') { 
       return res.json({ success: true, message: 'No records found to delete (table not initialized)', deletedCount: 0 });
    }
    res.status(500).json({ success: false, message: 'Failed to clear data' });
  }
};

module.exports = {
  clearEmployeeAuditLogs,
  clearAdminActivityLogs,
  clearMonthlyAttendance,
  clearDataByDate
};
