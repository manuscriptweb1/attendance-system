const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const { getAiSettings, testAiSettings, updateAiSettings, deleteAiKey } = require('../controllers/aiSettingsController');

function isSuperAdminUser(user) {
  if (user?.is_super_admin === true || user?.emergency_admin === true) return true;
  const role = String(user?.role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return role === 'super admin' || role === 'superadmin';
}

// The Gemini key can only be seen (masked), tested, changed or removed by a Super Admin
const requireSuperAdmin = (req, res, next) => {
  if (isSuperAdminUser(req.user)) return next();
  return res.status(403).json({ success: false, message: 'Access denied. Only a Super Admin can manage AI settings.' });
};

router.use(verifyToken, isAdmin, requireSuperAdmin);

router.get('/', getAiSettings);
router.put('/', updateAiSettings);
router.post('/test', testAiSettings);
router.delete('/key', deleteAiKey);

module.exports = router;
