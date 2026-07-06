const express = require('express');
const router = express.Router();
const { getMonthlyAttendanceReport, exportMonthlyAttendanceReport, generateMonthlyAttendanceReport, getReportSnapshot } = require('../controllers/reportController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/monthly-attendance', verifyToken, isAdmin, getMonthlyAttendanceReport);
router.get('/snapshot', verifyToken, isAdmin, getReportSnapshot);
router.post('/generate', verifyToken, isAdmin, generateMonthlyAttendanceReport);
router.get('/monthly-attendance/export', verifyToken, isAdmin, exportMonthlyAttendanceReport);

module.exports = router;
