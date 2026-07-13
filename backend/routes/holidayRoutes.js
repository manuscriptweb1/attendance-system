const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isEmployee, requirePermission } = require('../middleware/auth');
const {
  getAllHolidays,
  getHolidayByDate,
  addHoliday,
  updateHoliday,
  toggleHolidayStatus,
  deleteHoliday,
  checkHolidayStatus,
  clearHolidayRange
} = require('../controllers/holidayController');

// Admin routes
router.get('/', verifyToken, isAdmin, requirePermission('holidays', 'can_view'), getAllHolidays);
router.get('/date/:date', verifyToken, isAdmin, requirePermission('holidays', 'can_view'), getHolidayByDate);
router.post('/', verifyToken, isAdmin, requirePermission('holidays', 'can_create'), addHoliday);
router.delete('/clear-range', verifyToken, isAdmin, requirePermission('holidays', 'can_clear'), clearHolidayRange);
router.put('/:id', verifyToken, isAdmin, requirePermission('holidays', 'can_edit'), updateHoliday);
router.patch('/:id/toggle', verifyToken, isAdmin, requirePermission('holidays', 'can_edit'), toggleHolidayStatus);
router.delete('/:id', verifyToken, isAdmin, requirePermission('holidays', 'can_delete'), deleteHoliday);

// Employee route - check if today is holiday
router.get('/check', verifyToken, isEmployee, checkHolidayStatus);

module.exports = router;
