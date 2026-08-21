const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getPaidLeaveEmployees,
  markPaidLeave,
  clearPaidLeave
} = require('../controllers/paidLeaveController');

// All routes are admin-only
router.use(verifyToken, isAdmin);

// Routes with permission checks
router.get('/', requirePermission('absent_reasons', 'can_view'), getPaidLeaveEmployees);
router.post('/mark', requirePermission('absent_reasons', 'can_edit'), markPaidLeave);
router.put('/mark', requirePermission('absent_reasons', 'can_edit'), markPaidLeave);
router.delete('/:id', requirePermission('absent_reasons', 'can_delete'), clearPaidLeave);
router.post('/clear', requirePermission('absent_reasons', 'can_delete'), clearPaidLeave);

module.exports = router;
