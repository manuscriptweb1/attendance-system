const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isEmployee } = require('../middleware/auth');
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
router.get('/', verifyToken, isAdmin, getAllHolidays);
router.get('/date/:date', verifyToken, isAdmin, getHolidayByDate);
router.post('/', verifyToken, isAdmin, addHoliday);
router.delete('/clear-range', verifyToken, isAdmin, clearHolidayRange);
router.put('/:id', verifyToken, isAdmin, updateHoliday);
router.patch('/:id/toggle', verifyToken, isAdmin, toggleHolidayStatus);
router.delete('/:id', verifyToken, isAdmin, deleteHoliday);

// Employee route - check if today is holiday
router.get('/check', verifyToken, isEmployee, checkHolidayStatus);

module.exports = router;
