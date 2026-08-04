const {
  sendSinglePayslipEmail,
  sendSelectedPayslipEmails,
  sendAllPayslipsEmails,
  getPayrollEmailLogs
} = require('../services/payrollEmailService');
const { getClientIP } = require('../services/networkValidationService');

const sendPayslipEmail = async (req, res) => {
  try {
    const { employee_id, payrollId, employeeId, employeeCode, month, year } = req.body;
    const empId = employee_id || employeeId || employeeCode || payrollId;
    if (!empId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'employeeId / employeeCode, month, and year are required'
      });
    }

    const sentBy = req.user ? req.user.id : null;
    const sentByName = req.user ? (req.user.username || req.user.name || 'Admin') : 'Admin';
    const ipAddress = getClientIP(req);

    const result = await sendSinglePayslipEmail({
      employee_id: empId,
      payrollId,
      employeeId,
      employeeCode,
      month,
      year,
      sent_by: sentBy,
      sent_by_name: sentByName,
      ipAddress
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Send payslip email controller error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while sending payslip email'
    });
  }
};

const sendSelectedPayslips = async (req, res) => {
  try {
    const { employee_ids, month, year } = req.body;
    if (!Array.isArray(employee_ids) || employee_ids.length === 0 || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'employee_ids (array), month, and year are required'
      });
    }

    const sentBy = req.user ? req.user.id : null;
    const sentByName = req.user ? (req.user.username || req.user.name || 'Admin') : 'Admin';
    const ipAddress = getClientIP(req);

    const result = await sendSelectedPayslipEmails({
      employee_ids,
      month,
      year,
      sent_by: sentBy,
      sent_by_name: sentByName,
      ipAddress
    });

    res.json(result);
  } catch (error) {
    console.error('Send selected payslips controller error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while sending selected payslips'
    });
  }
};

const sendAllPayslips = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'month and year are required'
      });
    }

    const sentBy = req.user ? req.user.id : null;
    const sentByName = req.user ? (req.user.username || req.user.name || 'Admin') : 'Admin';
    const ipAddress = getClientIP(req);

    const result = await sendAllPayslipsEmails({
      month,
      year,
      sent_by: sentBy,
      sent_by_name: sentByName,
      ipAddress
    });

    res.json(result);
  } catch (error) {
    console.error('Send all payslips controller error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while sending all payslips'
    });
  }
};

const getLogs = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'month and year query parameters are required'
      });
    }

    const logs = await getPayrollEmailLogs(month, year);
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Get payroll email logs controller error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching email logs'
    });
  }
};

module.exports = {
  sendPayslipEmail,
  sendSelectedPayslips,
  sendAllPayslips,
  getLogs
};
