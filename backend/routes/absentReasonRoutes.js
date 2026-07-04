const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const {
  getAbsentEmployees,
  updateAbsentReason,
  clearAbsentReason,
  clearAbsentReasonRange
} = require('../controllers/absentReasonController');

// All routes are admin-only
router.use(verifyToken, isAdmin);

router.get('/', getAbsentEmployees);
router.put('/clear-range', clearAbsentReasonRange);
router.put('/:attendance_id', updateAbsentReason);
router.delete('/:attendance_id/clear', clearAbsentReason);

module.exports = router;
