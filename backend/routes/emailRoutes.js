const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const { getEmailHealth, sendTestEmail } = require('../controllers/emailController');

function isSuperAdminUser(user) {
  if (user?.is_super_admin === true || user?.emergency_admin === true) return true;
  const role = String(user?.role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return role === 'super admin' || role === 'superadmin';
}

const requireSuperAdminOrEmergency = (req, res, next) => {
  if (isSuperAdminUser(req.user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Only Super Admin or Emergency Admin can perform test email dispatch.'
  });
};

// Email Health route (Admin only)
router.get('/health', verifyToken, isAdmin, getEmailHealth);

// Email Test route (Super Admin / Emergency Admin only)
router.post('/test', verifyToken, isAdmin, requireSuperAdminOrEmergency, sendTestEmail);

module.exports = router;
