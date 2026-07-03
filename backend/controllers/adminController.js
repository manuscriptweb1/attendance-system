const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');
const { testEmailConfig } = require('../services/emailService');
// Get all admins
const getAllAdmins = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM admins ORDER BY created_at DESC'
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
  try {
    const { username, email, password } = req.body;

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

    // Insert new admin
    const result = await pool.query(
      'INSERT INTO admins (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, hashedPassword]
    );

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
      admin: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add admin'
    });
  }
};

// Update admin
const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email } = req.body;

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

    const oldData = { username: adminCheck.rows[0].username, email: adminCheck.rows[0].email };

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

    // Update admin
    const result = await pool.query(
      'UPDATE admins SET username = $1, email = $2 WHERE id = $3 RETURNING id, username, email, created_at',
      [username, email, id]
    );

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email,
      actionType: ADMIN_ACTION_TYPES.UPDATE_ADMIN,
      moduleName: MODULE_NAMES.ADMIN,
      description: `Updated admin account: ${username}`,
      oldData,
      newData: { username, email },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Admin updated successfully',
      admin: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin'
    });
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
  updateAdminTheme
};
