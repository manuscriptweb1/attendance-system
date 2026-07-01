const express = require('express');
const router = express.Router();
const { getMonthlyAttendanceReport, exportMonthlyAttendanceReport } = require('../controllers/reportController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/monthly-attendance', verifyToken, isAdmin, getMonthlyAttendanceReport);
router.get('/monthly-attendance/export', verifyToken, isAdmin, exportMonthlyAttendanceReport);

module.exports = router;
