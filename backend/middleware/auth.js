const jwt = require('jsonwebtoken');
const pool = require('../config/database');

function normalizeAdminRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

function isSuperAdminRole(user) {
  if (user?.is_super_admin === true) return true;

  const role = normalizeAdminRole(user?.role);
  return role === "super admin" || role === "superadmin";
}


// Verify JWT Token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.emergency_admin === true) {
      if (process.env.EMERGENCY_ADMIN_ENABLED !== "true") {
        return res.status(401).json({
          success: false,
          message: "Emergency admin disabled"
        });
      }

      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: "Super Admin",
        is_super_admin: true,
        emergency_admin: true
      };

      return next();
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }
};

// Admin Authorization
const isAdmin = (req, res, next) => {
  if (req.user?.emergency_admin === true) {
    return next();
  }
  const isSuperAdmin = isSuperAdminRole(req.user);
  if (req.user.role !== 'admin' && !isSuperAdmin) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin only.' 
    });
  }
  next();
};

// Employee Authorization
const isEmployee = (req, res, next) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Employee only.' 
    });
  }
  next();
};

// Permission Middleware
const requirePermission = (pageKey, action) => {
  return async (req, res, next) => {
    try {
      if (req.user?.emergency_admin === true) {
        return next();
      }
      const isSuperAdmin = isSuperAdminRole(req.user);
      
      if (req.user.role !== 'admin' && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin only.'
        });
      }

      // Super admin bypass
      if (isSuperAdmin) {
        return next();
      }

      // Check DB for permission
      const result = await pool.query(
        'SELECT * FROM admin_permissions WHERE admin_id = $1 AND page_key = $2',
        [req.user.id, pageKey]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action',
          code: 'PERMISSION_DENIED'
        });
      }

      const permissions = result.rows[0];
      
      // If action is provided, check specific action, else just check if record exists
      if (action && !permissions[action]) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action',
          code: 'PERMISSION_DENIED'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ success: false, message: 'Server error during permission check' });
    }
  };
};

// ─── HR Scanner role (Smart Attendance) ───────────────────────────────
// HR Scanner accounts live in the admins table with role = 'hr'. They are
// rejected by isAdmin/requirePermission, so they can never reach admin pages;
// they can only use the Smart Attendance scanner endpoints below.
function isHrRole(user) {
  const role = normalizeAdminRole(user?.role);
  return role === 'hr' || role === 'hr scanner';
}

async function isActiveAdminAccount(adminId) {
  if (!Number.isInteger(Number(adminId))) return false;
  const result = await pool.query('SELECT status FROM admins WHERE id = $1', [adminId]);
  if (result.rows.length === 0) return false;
  return (result.rows[0].status || 'Active') === 'Active';
}

// Only HR Scanner accounts
const isHr = async (req, res, next) => {
  try {
    if (!isHrRole(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied. HR Scanner accounts only.', code: 'HR_ONLY' });
    }
    if (!(await isActiveAdminAccount(req.user.id))) {
      return res.status(403).json({ success: false, message: 'Your HR Scanner account is inactive. Contact the Super Admin.', code: 'ACCOUNT_INACTIVE' });
    }
    next();
  } catch (error) {
    console.error('HR check error:', error);
    res.status(500).json({ success: false, message: 'Server error during permission check' });
  }
};

// HR Scanner accounts OR admins with the given page permission (super admin always)
const requireHrOrPermission = (pageKey, action) => {
  const adminCheck = requirePermission(pageKey, action);
  return (req, res, next) => {
    if (isHrRole(req.user)) return isHr(req, res, next);
    return adminCheck(req, res, next);
  };
};

module.exports = { verifyToken, isAdmin, isEmployee, requirePermission, isHr, isHrRole, requireHrOrPermission };
