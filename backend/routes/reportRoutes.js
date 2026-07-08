const express = require('express');
const router = express.Router();
const { getMonthlyAttendanceReport, exportMonthlyAttendanceReport, generateMonthlyAttendanceReport, getReportSnapshot } = require('../controllers/reportController');
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');

router.get('/monthly-attendance', verifyToken, isAdmin, requirePermission('reports', 'can_view'), getMonthlyAttendanceReport);
router.get('/snapshot', verifyToken, isAdmin, requirePermission('reports', 'can_view'), getReportSnapshot);
router.post('/generate', verifyToken, isAdmin, requirePermission('reports', 'can_calculate'), generateMonthlyAttendanceReport);
router.get('/monthly-attendance/export', verifyToken, isAdmin, requirePermission('reports', 'can_export'), exportMonthlyAttendanceReport);

module.exports = router;
