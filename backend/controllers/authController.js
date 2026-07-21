const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { validateTrustedDevice } = require('../services/deviceFingerprintService');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { isElectronRequest, verifyElectronSignature } = require('../utils/electronDeviceVerifier');

// Admin Login
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    const identifier = String(req.body.username || req.body.email || req.body.identifier || "").trim();
    const enteredPassword = String(password || "");

    async function tryEmergencyAdminLogin(ident, pass) {
      if (process.env.EMERGENCY_ADMIN_ENABLED !== "true") {
        return null;
      }
      const enteredIdentifier = String(ident || "").trim();
      const emergencyUsername = String(process.env.EMERGENCY_ADMIN_USERNAME || "").trim();
      if (!emergencyUsername || enteredIdentifier !== emergencyUsername) {
        return null;
      }
      let passwordMatches = false;
      if (process.env.EMERGENCY_ADMIN_PASSWORD_HASH) {
        passwordMatches = await bcrypt.compare(pass, process.env.EMERGENCY_ADMIN_PASSWORD_HASH);
      } else if (process.env.EMERGENCY_ADMIN_PASSWORD) {
        passwordMatches = pass === process.env.EMERGENCY_ADMIN_PASSWORD;
      }
      if (!passwordMatches) return null;
      return {
        id: "emergency-super-admin",
        username: process.env.EMERGENCY_ADMIN_USERNAME,
        email: process.env.EMERGENCY_ADMIN_EMAIL,
        role: "Super Admin",
        is_super_admin: true,
        emergency_admin: true,
        permissions: {}
      };
    }

    const sendEmergencyAdminLoginResponse = (res, emergencyAdmin) => {
      const token = jwt.sign(
        { 
          id: emergencyAdmin.id, 
          username: emergencyAdmin.username,
          email: emergencyAdmin.email,
          role: emergencyAdmin.role,
          is_super_admin: true,
          emergency_admin: true
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );
      
      return res.json({
        success: true,
        message: 'Emergency Login successful',
        token,
        user: emergencyAdmin
      });
    };

    let result;
    try {
      result = await pool.query(
        'SELECT * FROM admins WHERE username = $1 OR email = $1',
        [username]
      );
    } catch (err) {
      console.error('Admin query failed:', err.message);
    }

    if (!result || !result.rows || result.rows.length === 0) {
      const emergencyAdmin = await tryEmergencyAdminLogin(identifier, enteredPassword);
      if (emergencyAdmin) {
        return sendEmergencyAdminLoginResponse(res, emergencyAdmin);
      }
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username',
        field: 'username'
      });
    }

    const admin = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(enteredPassword, admin.password);

    if (!isValidPassword) {
      const emergencyAdmin = await tryEmergencyAdminLogin(identifier, enteredPassword);
      if (emergencyAdmin) {
        return sendEmergencyAdminLoginResponse(res, emergencyAdmin);
      }
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password',
        field: 'password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: admin.role || 'admin',
        is_super_admin: admin.is_super_admin 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    // Fetch permissions
    const permissionsResult = await pool.query(
      'SELECT * FROM admin_permissions WHERE admin_id = $1',
      [admin.id]
    );

    const permissions = {};
    permissionsResult.rows.forEach(p => {
      permissions[p.page_key] = {
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        can_export: p.can_export,
        can_clear: p.can_clear,
        can_calculate: p.can_calculate,
        can_approve: p.can_approve
      };
    });

    // Log admin login
    try {
      await pool.query(
        `INSERT INTO admin_login_logs (admin_id, username, ip_address, browser_info, device_info, login_time)
         VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'UTC')`,
        [
          admin.id,
          admin.username,
          req.body.ip_address || req.ip || 'Unknown',
          req.body.browser_info || req.headers['user-agent'] || 'Unknown',
          req.body.device_info || 'Unknown'
        ]
      );

      // Log admin activity
      await logAdminActivity({
        adminId: admin.id,
        adminName: admin.username,
        adminEmail: admin.email,
        actionType: ADMIN_ACTION_TYPES.ADMIN_LOGIN,
        moduleName: MODULE_NAMES.ADMIN,
        description: `Admin ${admin.username} logged in successfully`,
        ipAddress: req.body.ip_address || req.ip || 'Unknown',
        deviceInfo: req.body.device_info || 'Unknown',
        browserInfo: req.body.browser_info || req.headers['user-agent'] || 'Unknown'
      });
    } catch (logError) {
      console.error('Error logging admin login:', logError);
      // Continue even if logging fails
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role || 'admin',
        is_super_admin: admin.is_super_admin,
        theme_preference: admin.theme_preference || 'dark',
        permissions: permissions
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Employee Login
const employeeLogin = async (req, res) => {
  try {
    const { employee_id, password } = req.body;

    if (!employee_id || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Employee ID and password are required' 
      });
    }

    // Find employee with department info
    const result = await pool.query(
      `SELECT e.*, d.name as department_name 
       FROM employees e 
       LEFT JOIN departments d ON e.department_id = d.id 
       WHERE e.employee_id = $1`,
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid employee ID',
        field: 'employee_id'
      });
    }

    const employee = result.rows[0];

    // Check if employee is active
    if (employee.status !== 'Active') {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account is inactive. Please contact admin.',
        field: 'status'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, employee.password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password',
        field: 'password'
      });
    }

    // === TRUSTED DEVICE VALIDATION ===
    const isElectron = isElectronRequest(req);
    
    if (isElectron) {
      // ELECTRON DESKTOP LOGIN FLOW
      const verificationResult = verifyElectronSignature(req);
      
      if (!verificationResult.valid) {
        return res.status(403).json({
          success: false,
          errorCode: 'INVALID_SIGNATURE',
          title: 'Desktop Device Verification Failed',
          message: verificationResult.message || 'We could not verify this desktop device. Please use the official Attendance Desktop App.'
        });
      }

      // Check trusted_devices table for Electron device
      const { publicKey, publicKeyHash, hostname, platform, appVersion } = verificationResult;
      
      const deviceResult = await pool.query(
        `SELECT * FROM trusted_devices 
         WHERE employee_id = $1 AND desktop_public_key_hash = $2 AND device_source = 'electron-desktop'`,
        [employee.employee_id, publicKeyHash]
      );

      if (deviceResult.rows.length === 0) {
        // Create new Pending request
        await pool.query(
          `INSERT INTO trusted_devices 
           (employee_id, employee_name, device_fingerprint, device_source, desktop_public_key, desktop_public_key_hash, desktop_hostname, desktop_platform, electron_app_version, approved_status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending')`,
          [
            employee.employee_id, 
            employee.name, 
            `electron-${publicKeyHash}`,
            'electron-desktop',
            publicKey,
            publicKeyHash,
            hostname,
            platform,
            appVersion
          ]
        );
        
        return res.status(403).json({
          success: false,
          errorCode: 'DEVICE_APPROVAL_REQUIRED',
          message: 'This desktop device is not approved yet. Please wait for administrator approval before signing in.'
        });
      }

      const device = deviceResult.rows[0];

      if (device.approved_status === 'Pending') {
        return res.status(403).json({
          success: false,
          errorCode: 'DEVICE_APPROVAL_PENDING',
          message: 'Your desktop device approval request is still pending. Please contact your administrator.'
        });
      }

      if (device.approved_status === 'Rejected') {
        return res.status(403).json({
          success: false,
          errorCode: 'DEVICE_REJECTED',
          message: 'This desktop device was rejected by your administrator. Please contact your administrator.'
        });
      }

      if (device.approved_status === 'Blocked') {
        return res.status(403).json({
          success: false,
          errorCode: 'DEVICE_BLOCKED',
          message: 'This desktop device has been blocked by your administrator. Please contact your administrator.'
        });
      }

      // Approved! Update last_used
      await pool.query(
        `UPDATE trusted_devices 
         SET last_used = CURRENT_TIMESTAMP, desktop_signature_verified_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [device.id]
      );

    } else {
      // NORMAL BROWSER LOGIN FLOW
      // Always check for Blocked status, even during login
      const settings = await getSettingsFromDB();
      const validationEnabled = settings.trustedDevice ? settings.trustedDevice.validationEnabled : false;
      
      const deviceValidation = await validateTrustedDevice(employee.employee_id, employee.name, req, validationEnabled, {});

      if (!deviceValidation.valid) {
        // If validation fails (either explicitly blocked, or it's enabled and not approved)
        return res.status(403).json(deviceValidation);
      }
    }


    // Generate JWT token
    const token = jwt.sign(
      { 
        id: employee.id, 
        employee_id: employee.employee_id, 
        role: 'employee' 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: employee.id,
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email,
        department: employee.department_name,
        job_role: employee.job_role,
        mobile: employee.mobile,
        date_of_birth: employee.date_of_birth,
        role: 'employee'
      }
    });

  } catch (error) {
    console.error('Employee login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

module.exports = { adminLogin, employeeLogin };
