const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getAbsentEmployees,
  updateAbsentReason,
  clearAbsentReason,
  clearAbsentReasonRange
} = require('../controllers/absentReasonController');

// All routes are admin-only
router.use(verifyToken, isAdmin);

router.get('/', requirePermission('absent_reasons', 'can_view'), getAbsentEmployees);
router.put('/clear-range', requirePermission('absent_reasons', 'can_clear'), clearAbsentReasonRange);
router.put('/:attendance_id', requirePermission('absent_reasons', 'can_edit'), updateAbsentReason);
router.delete('/:attendance_id/clear', requirePermission('absent_reasons', 'can_clear'), clearAbsentReason);

module.exports = router;
