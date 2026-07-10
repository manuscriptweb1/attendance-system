const jwt = require('jsonwebtoken');

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
  const isSuperAdmin = req.user.is_super_admin === true || req.user.isSuperAdmin === true || req.user.role === 'super_admin';
  if (req.user.role !== 'admin' && !isSuperAdmin) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin only.' 
    });
  }
  next();
};

const pool = require('../config/database');

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
      const isSuperAdmin = req.user.is_super_admin === true || req.user.isSuperAdmin === true || req.user.role === 'super_admin';
      
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

module.exports = { verifyToken, isAdmin, isEmployee, requirePermission };
