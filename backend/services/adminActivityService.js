const pool = require('../config/database');

/**
 * Log admin activity
 */
const logAdminActivity = async ({
  adminId,
  adminName,
  adminEmail,
  actionType,
  moduleName,
  description,
  oldData = null,
  newData = null,
  ipAddress = null,
  deviceInfo = null,
  browserInfo = null
}) => {
  try {
    await pool.query(
      `INSERT INTO admin_activity_logs 
       (admin_id, admin_name, admin_email, action_type, module_name, description, 
        old_data, new_data, ip_address, device_info, browser_info, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() AT TIME ZONE 'UTC')`,
      [
        adminId,
        adminName,
        adminEmail,
        actionType,
        moduleName,
        description,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ipAddress,
        deviceInfo,
        browserInfo
      ]
    );
    return { success: true };
  } catch (error) {
    console.error('Admin activity logging error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get admin activity logs with filters and pagination
 */
const getAdminActivityLogs = async (filters = {}) => {
  try {
    let query = `
      SELECT *, created_at AT TIME ZONE 'UTC' AS created_at_utc FROM admin_activity_logs 
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filter by admin
    if (filters.adminId) {
      query += ` AND admin_id = $${paramCount}`;
      params.push(filters.adminId);
      paramCount++;
    }

    // Filter by action type
    if (filters.actionType) {
      query += ` AND action_type = $${paramCount}`;
      params.push(filters.actionType);
      paramCount++;
    }

    // Filter by module
    if (filters.moduleName) {
      query += ` AND module_name = $${paramCount}`;
      params.push(filters.moduleName);
      paramCount++;
    }

    // Filter by date range
    if (filters.startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(filters.startDate);
      paramCount++;
    }

    if (filters.endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(filters.endDate);
      paramCount++;
    }

    // Search
    if (filters.search) {
      query += ` AND (admin_name ILIKE $${paramCount} OR admin_email ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    // Count total before pagination
    const countQuery = query.replace(/SELECT .* FROM/i, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Sort
    if (filters.sortOrder === 'asc') {
      query += ' ORDER BY created_at ASC';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const offset = (page - 1) * limit;

    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return {
      success: true,
      logs: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Get admin activity logs error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get activity statistics
 */
const getActivityStats = async () => {
  try {
    // Today's activities
    const todayResult = await pool.query(
      `SELECT COUNT(*) FROM admin_activity_logs 
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    // This week's activities
    const weekResult = await pool.query(
      `SELECT COUNT(*) FROM admin_activity_logs 
       WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)`
    );

    // Total activities
    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM admin_activity_logs'
    );

    // Recent activities (last 5)
    const recentResult = await pool.query(
      `SELECT *, created_at AT TIME ZONE 'UTC' AS created_at_utc FROM admin_activity_logs 
       ORDER BY created_at DESC 
       LIMIT 5`
    );

    return {
      success: true,
      stats: {
        today: parseInt(todayResult.rows[0].count),
        thisWeek: parseInt(weekResult.rows[0].count),
        total: parseInt(totalResult.rows[0].count),
        recent: recentResult.rows
      }
    };
  } catch (error) {
    console.error('Get activity stats error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Action Types Constants
 */
const ADMIN_ACTION_TYPES = {
  // Admin Management
  ADMIN_LOGIN: 'Admin Login',
  ADMIN_LOGOUT: 'Admin Logout',
  CREATE_ADMIN: 'Create Admin',
  UPDATE_ADMIN: 'Update Admin',
  DELETE_ADMIN: 'Delete Admin',
  
  // Employee Management
  CREATE_EMPLOYEE: 'Create Employee',
  UPDATE_EMPLOYEE: 'Update Employee',
  DELETE_EMPLOYEE: 'Delete Employee',
  RESET_EMPLOYEE_PASSWORD: 'Reset Employee Password',
  
  // Holiday Management
  CREATE_HOLIDAY: 'Create Holiday',
  UPDATE_HOLIDAY: 'Update Holiday',
  DELETE_HOLIDAY: 'Delete Holiday',
  TOGGLE_HOLIDAY: 'Toggle Holiday',
  
  // Settings Management
  UPDATE_SETTINGS: 'Update Settings',
  UPDATE_OTP_SETTINGS: 'Update OTP Settings',
  
  // Device Management
  APPROVE_DEVICE: 'Approve Device',
  REJECT_DEVICE: 'Reject Device',
  UPDATE_DEVICE_ALIAS: 'Update Device Alias',
  REMOVE_DEVICE_APPROVAL: 'Remove Device Approval',
  DELETE_DEVICE: 'Delete Device',
  
  // Attendance Management
  MODIFY_ATTENDANCE: 'Modify Attendance',
  MANUAL_CHECKIN: 'Manual Check-In',
  MANUAL_CHECKOUT: 'Manual Check-Out',
  DELETE_ATTENDANCE: 'Delete Attendance',
  
  // Reports & Export
  EXPORT_ATTENDANCE: 'Export Attendance',
  DOWNLOAD_REPORT: 'Download Report',
  GENERATE_PDF: 'Generate PDF',
  
  // Permissions
  GRANT_WFH_PERMISSION: 'Grant WFH Permission',
  REVOKE_WFH_PERMISSION: 'Revoke WFH Permission',
  GRANT_EARLY_CHECKOUT: 'Grant Early Checkout Permission',
  REVOKE_EARLY_CHECKOUT: 'Revoke Early Checkout Permission',
  
  // Data Clearing
  CLEAR_RANGE: 'CLEAR_RANGE',
  
  // Expense Management
  CREATE_EXPENSE: 'CREATE',
  UPDATE_EXPENSE: 'UPDATE',
  DELETE_EXPENSE: 'DELETE',
  CREATE_EXPENSE_TYPE: 'CREATE',
  UPDATE_EXPENSE_TYPE: 'UPDATE',
  DELETE_EXPENSE_TYPE: 'DELETE',
  
  // Payroll Management
  CALCULATE_PAYROLL: 'CALCULATE',
  CALCULATE_ALL_PAYROLL: 'CALCULATE_ALL',
  UPDATE_PAYROLL: 'UPDATE',
  DOWNLOAD_PAYROLL: 'DOWNLOAD'
};

/**
 * Module Names Constants
 */
const MODULE_NAMES = {
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
  ATTENDANCE: 'Attendance',
  HOLIDAY: 'Holiday',
  SETTINGS: 'Settings',
  DEVICE: 'Device',
  SECURITY: 'Security Logs',
  REPORTS: 'Reports',
  PERMISSIONS: 'Permissions',
  MANUAL_ATTENDANCE: 'Manual Attendance',
  ABSENT_REASONS: 'Absent Reasons',
  PAYROLL: 'Payroll',
  EXPENSES: 'Expenses',
  ACTIVITY_LOGS: 'Activity Logs'
};

module.exports = {
  logAdminActivity,
  getAdminActivityLogs,
  getActivityStats,
  ADMIN_ACTION_TYPES,
  MODULE_NAMES
};
