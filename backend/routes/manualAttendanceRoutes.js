const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getEmployeesForManualAttendance,
  createManualAttendance,
  updateManualAttendance,
  deleteManualAttendance,
  checkInRow,
  checkOutRow,
  clearManualAttendanceRange
} = require('../controllers/manualAttendanceController');

// All routes are admin-only
router.use(verifyToken, isAdmin);

router.get('/employees', requirePermission('manual_attendance', 'can_view'), getEmployeesForManualAttendance);
router.post('/check-in', requirePermission('manual_attendance', 'can_create'), checkInRow);
router.post('/check-out', requirePermission('manual_attendance', 'can_edit'), checkOutRow);
router.post('/', requirePermission('manual_attendance', 'can_create'), createManualAttendance);
router.delete('/clear-range', requirePermission('manual_attendance', 'can_clear'), clearManualAttendanceRange);
router.put('/:id', requirePermission('manual_attendance', 'can_edit'), updateManualAttendance);
router.delete('/:id', requirePermission('manual_attendance', 'can_delete'), deleteManualAttendance);

module.exports = router;
