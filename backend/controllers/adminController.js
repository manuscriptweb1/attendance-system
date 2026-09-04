const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');
const { testEmailConfig } = require('../services/emailService');

// Get all admin pages
const getAdminPages = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admin_pages ORDER BY sort_order ASC');
    res.json({
      success: true,
      pages: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin pages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin pages' });
  }
};

// Get admin permissions
const getAdminPermissions = async (req, res) => {
  try {
    const { adminId } = req.params;
    const result = await pool.query('SELECT * FROM admin_permissions WHERE admin_id = $1', [adminId]);
    res.json({
      success: true,
      permissions: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin permissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch permissions' });
  }
};

// Get all admins
const getAllAdmins = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, is_super_admin, status, created_at FROM admins ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      admins: result.rows
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins'
    });
  }
};

// Add new admin
const addAdmin = async (req, res) => {
  let client;
  try {
    const { username, email, password, role = 'admin', status = 'Active', permissions = [] } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if username already exists
    const usernameCheck = await pool.query(
      'SELECT id FROM admins WHERE username = $1',
      [username]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT id FROM admins WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const isSuperAdmin = role === 'super_admin';

    client = await pool.connect();
    await client.query('BEGIN');

    // Insert new admin
    const result = await client.query(
      'INSERT INTO admins (username, email, password, role, is_super_admin, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, role, status, created_at',
      [username, email, hashedPassword, role, isSuperAdmin, status]
    );
    const newAdmin = result.rows[0];

    // Insert permissions if provided and not super admin
    if (permissions && Array.isArray(permissions) && !isSuperAdmin) {
      for (const p of permissions) {
        await client.query(
          `INSERT INTO admin_permissions (
            admin_id, page_key, can_view, can_create, can_edit, can_delete, can_export, can_clear, can_calculate, can_approve
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            newAdmin.id, p.page_key, 
            !!p.can_view, !!p.can_create, !!p.can_edit, !!p.can_delete, 
            !!p.can_export, !!p.can_clear, !!p.can_calculate, !!p.can_approve
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email,
      actionType: ADMIN_ACTION_TYPES.CREATE_ADMIN,
      moduleName: MODULE_NAMES.ADMIN,
      description: `Created new admin account: ${username}`,
      newData: { username, email },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Admin added successfully',
      admin: newAdmin
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error adding admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add admin'
    });
  } finally {
    if (client) client.release();
  }
};

const PAGE_NAMES = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  departments: 'Departments',
  admin_management: 'Admin Management',
  attendance: 'Attendance',
  manual_attendance: 'Manual Attendance',
  absent_reasons: 'Absent Reasons',
  holidays: 'Holidays',
  payroll: 'Payroll',
  expenses: 'Expenses',
  reports: 'Reports',
  settings: 'Settings',
  manage: 'Manage',
  database_monitor: 'Database Monitor',
  trusted_devices: 'Trusted Devices',
  activity_logs: 'Activity Logs',
  otp_settings: 'OTP Settings',
  security_logs: 'Security Logs'
};

const ACTION_NAMES = {
  can_view: 'View',
  can_create: 'Create',
  can_edit: 'Edit',
  can_delete: 'Delete',
  can_export: 'Export',
  can_clear: 'Clear',
  can_calculate: 'Calculate',
  can_approve: 'Approve'
};

const compareAdminPermissions = (oldPermsArray, newPermsArray) => {
  const changes = [];
  const oldMap = {};
  const newMap = {};

  (oldPermsArray || []).forEach(p => { oldMap[p.page_key] = p; });
  (newPermsArray || []).forEach(p => { newMap[p.page_key] = p; });

  const allPages = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

  allPages.forEach(pageKey => {
    const pageName = PAGE_NAMES[pageKey] || pageKey;
    const oldP = oldMap[pageKey] || {};
    const newP = newMap[pageKey] || {};

    Object.keys(ACTION_NAMES).forEach(actionKey => {
      const oldVal = !!oldP[actionKey];
      const newVal = !!newP[actionKey];

      if (oldVal !== newVal) {
        let actionName = ACTION_NAMES[actionKey];
        if (pageKey === 'reports' && actionKey === 'can_calculate') {
          actionName = 'Generate';
        }
        changes.push({
          page: pageName,
          action: actionName,
          from: oldVal,
          to: newVal
        });
      }
    });
  });

  return changes;
};

// Update admin
const updateAdmin = async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { username, email, role = 'admin', status = 'Active', permissions } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Username and email are required'
      });
    }

    // Check if admin exists
    const adminCheck = await pool.query(
      'SELECT * FROM admins WHERE id = $1',
      [id]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const currentAdmin = adminCheck.rows[0];
    const oldData = { 
      username: currentAdmin.username, 
      email: currentAdmin.email,
      role: currentAdmin.role,
      status: currentAdmin.status
    };

    // Fetch old permissions
    const oldPermissionsRes = await pool.query('SELECT * FROM admin_permissions WHERE admin_id = $1', [id]);
    const oldPermissions = oldPermissionsRes.rows;

    // Check if username already exists (excluding current admin)
    const usernameCheck = await pool.query(
      'SELECT id FROM admins WHERE username = $1 AND id != $2',
      [username, id]
    );

    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Check if email already exists (excluding current admin)
    const emailCheck = await pool.query(
      'SELECT id FROM admins WHERE email = $1 AND id != $2',
      [email, id]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const isSuperAdmin = role === 'super_admin';

    client = await pool.connect();
    await client.query('BEGIN');

    // Update admin
    const result = await client.query(
      'UPDATE admins SET username = $1, email = $2, role = $3, is_super_admin = $4, status = $5 WHERE id = $6 RETURNING id, username, email, role, status, created_at',
      [username, email, role, isSuperAdmin, status, id]
    );
    const updatedAdmin = result.rows[0];

    if (permissions && Array.isArray(permissions) && !isSuperAdmin) {
      // Clear old permissions
      await client.query('DELETE FROM admin_permissions WHERE admin_id = $1', [id]);
      
      // Insert new permissions
      for (const p of permissions) {
        await client.query(
          `INSERT INTO admin_permissions (
            admin_id, page_key, can_view, can_create, can_edit, can_delete, can_export, can_clear, can_calculate, can_approve
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id, p.page_key, 
            !!p.can_view, !!p.can_create, !!p.can_edit, !!p.can_delete, 
            !!p.can_export, !!p.can_clear, !!p.can_calculate, !!p.can_approve
          ]
        );
      }
    } else if (isSuperAdmin) {
       // Optional: Clean up permissions if super admin
       await client.query('DELETE FROM admin_permissions WHERE admin_id = $1', [id]);
    }

    await client.query('COMMIT');

    // Compare and build log description
    let descriptionParts = [];
    if (oldData.username !== username) descriptionParts.push(`Username changed from "${oldData.username}" to "${username}"`);
    if (oldData.email !== email) descriptionParts.push(`Email changed from "${oldData.email}" to "${email}"`);
    if (oldData.role !== role) {
      const formatRole = r => r === 'super_admin' ? 'Super Admin' : 'Limited Admin';
      descriptionParts.push(`Role changed from ${formatRole(oldData.role)} to ${formatRole(role)}`);
    }
    if (oldData.status !== status) descriptionParts.push(`Status changed from ${oldData.status} to ${status}`);

    let permissionChanges = [];
    if (permissions && Array.isArray(permissions) && !isSuperAdmin) {
      permissionChanges = compareAdminPermissions(oldPermissions, permissions);
    } else if (isSuperAdmin && oldData.role !== 'super_admin') {
      // Transitioning to super admin
      permissionChanges = [{ page: 'All', action: 'Full Access', from: false, to: true }];
    }

    if (permissionChanges.length > 0) {
      const diffStrings = permissionChanges.slice(0, 10).map(c => `${c.page} ${c.action} ${c.from ? 'Yes' : 'No'} → ${c.to ? 'Yes' : 'No'}`);
      let permText = `Permissions changed: ${diffStrings.join(', ')}`;
      if (permissionChanges.length > 10) permText += ` and ${permissionChanges.length - 10} more permission changes.`;
      descriptionParts.push(permText);
    }

    let finalDescription = '';
    if (descriptionParts.length === 0) {
      finalDescription = `Updated admin ${username} without specific changes.`;
    } else {
      finalDescription = `Updated admin ${username}. ${descriptionParts.join('; ')}`;
    }

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email,
      actionType: ADMIN_ACTION_TYPES.UPDATE_ADMIN,
      moduleName: MODULE_NAMES.ADMIN,
      description: finalDescription,
      oldData,
      newData: { 
        target_admin: username, 
        changes: permissionChanges.length > 0 ? permissionChanges : null,
        details: { username, email, role, status }
      },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Admin updated successfully',
      admin: updatedAdmin
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error updating admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin'
    });
  } finally {
    if (client) client.release();
  }
};

// Delete admin
const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const currentAdminId = req.user.id; // Get currently logged-in admin ID from JWT token

    // Check if trying to delete own account
    if (parseInt(id) === parseInt(currentAdminId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own admin account. Please ask another administrator to delete your account.'
      });
    }

    // Check if admin exists
    const adminCheck = await pool.query(
      'SELECT id, username FROM admins WHERE id = $1',
      [id]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if this is the last admin
    const adminCount = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminCount.rows[0].count) <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last admin account. At least one administrator must remain.'
      });
    }

    // Update all foreign key references to NULL before deleting
    // This prevents foreign key constraint violations
    
    // 1. Update wfh_permissions
    await pool.query('UPDATE wfh_permissions SET enabled_by = NULL WHERE enabled_by = $1', [id]);
    
    // 2. Update early_checkout_permissions
    await pool.query('UPDATE early_checkout_permissions SET enabled_by = NULL WHERE enabled_by = $1', [id]);
    
    // 3. Update holidays
    await pool.query('UPDATE holidays SET created_by = NULL WHERE created_by = $1', [id]);
    
    // Delete admin (login logs will be deleted automatically due to CASCADE)
    await pool.query('DELETE FROM admins WHERE id = $1', [id]);

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email,
      actionType: ADMIN_ACTION_TYPES.DELETE_ADMIN,
      moduleName: MODULE_NAMES.ADMIN,
      description: `Deleted admin account: ${adminCheck.rows[0].username}`,
      oldData: { username: adminCheck.rows[0].username },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `Admin account "${adminCheck.rows[0].username}" has been deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin account. Please try again.'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { adminId, currentPassword, newPassword } = req.body;

    if (!adminId || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Get admin
    const result = await pool.query(
      'SELECT * FROM admins WHERE id = $1',
      [adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const admin = result.rows[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE admins SET password = $1 WHERE id = $2',
      [hashedPassword, adminId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

// Get admin login logs
const getLoginLogs = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        al.id,
        al.admin_id,
        al.username,
        al.login_time,
        al.login_time AT TIME ZONE 'UTC' AS login_time_utc,
        al.ip_address,
        al.browser_info,
        al.device_info
      FROM admin_login_logs al
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      params.push(startDate);
      query += ` AND al.login_time >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND al.login_time <= $${params.length}`;
    }

    query += ' ORDER BY al.login_time DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      logs: result.rows
    });
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch login logs'
    });
  }
};

// System Health Check
const getSystemHealth = async (req, res) => {
  try {
    const health = {
      database: { status: 'Offline', color: 'text-red-400', bg: 'bg-red-500/20' },
      backend: { status: 'Running', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
      email: { status: 'Offline', color: 'text-red-400', bg: 'bg-red-500/20' },
      cron: { status: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/20' }
    };

    // 1. Check Database
    try {
      const dbStart = Date.now();
      await pool.query('SELECT 1');
      const dbPing = Date.now() - dbStart;
      health.database = { 
        status: `Online (${dbPing}ms)`, 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/20' 
      };
    } catch (e) {
      console.error('DB Health Check Failed:', e);
    }

    // 2. Check Email Service
    try {
      const emailTest = await testEmailConfig();
      if (emailTest.success) {
        health.email = { status: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
      } else {
        health.email = { status: 'Failed', color: 'text-red-400', bg: 'bg-red-500/20' };
      }
    } catch (e) {
      console.error('Email Health Check Failed:', e);
    }

    res.json({ success: true, health });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Health check failed' });
  }
};

// Get admin theme preference
const getAdminTheme = async (req, res) => {
  try {
    const adminId = req.user.id;

    // Return default theme for emergency env super admin without DB query
    if (req.user?.emergency_admin || adminId === 'emergency-super-admin') {
      return res.json({
        success: true,
        theme: 'dark'
      });
    }

    const result = await pool.query(
      'SELECT theme_preference FROM admins WHERE id = $1',
      [adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      theme: result.rows[0].theme_preference || 'dark'
    });
  } catch (error) {
    console.error('Error fetching admin theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theme preference'
    });
  }
};

// Update admin theme preference
const updateAdminTheme = async (req, res) => {
  try {
    const adminId = req.user.id; // From JWT
    const { theme } = req.body;

    if (!theme || !['dark', 'light'].includes(theme)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid theme preference. Must be "dark" or "light"'
      });
    }

    // Return success for emergency env super admin without DB query
    if (req.user?.emergency_admin || adminId === 'emergency-super-admin') {
      return res.json({
        success: true,
        theme: theme,
        message: 'Theme preference updated successfully'
      });
    }

    await pool.query(
      'UPDATE admins SET theme_preference = $1 WHERE id = $2',
      [theme, adminId]
    );

    res.json({
      success: true,
      theme: theme,
      message: 'Theme preference updated successfully'
    });
  } catch (error) {
    console.error('Error updating admin theme:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update theme preference'
    });
  }
};

module.exports = {
  getAllAdmins,
  addAdmin,
  updateAdmin,
  deleteAdmin,
  changePassword,
  getLoginLogs,
  getSystemHealth,
  getAdminTheme,
  updateAdminTheme,
  getAdminPages,
  getAdminPermissions
};
