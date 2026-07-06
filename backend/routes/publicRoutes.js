const express = require('express');
const router = express.Router();
const { 
  getPublicAttendanceMatrix, 
  getPublicHolidayInfo 
} = require('../controllers/publicController');

// Public endpoints (no authentication required)
router.get('/attendance-matrix', getPublicAttendanceMatrix);
router.get('/holiday-info', getPublicHolidayInfo);

module.exports = router;
