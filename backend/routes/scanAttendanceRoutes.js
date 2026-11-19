const express = require('express');
const router = express.Router();
const { verifyToken, isEmployee, isHr, requirePermission, requireHrOrPermission } = require('../middleware/auth');
const c = require('../controllers/scanAttendanceController');

const PAGE = 'attendance_scanner';

// ── Kiosk devices (entrance PC / tablet) – authenticated by kiosk key ──
router.get('/kiosk/session', c.kioskAuth, c.kioskSession);
router.post('/kiosk/scan', c.kioskAuth, c.kioskScan);

// Everything below needs a logged-in user
router.use(verifyToken);

// ── Employee self-service ──
router.get('/me/status', isEmployee, c.myStatus);
router.get('/me/badge', isEmployee, c.myBadge);

// ── HR Scanner mobile app (HR role only) ──
router.get('/hr/session', isHr, c.hrSession);
router.post('/hr/scan', isHr, c.hrScan);

// ── Shared: HR Scanner + Admin / Super Admin ──
router.get('/employees', requireHrOrPermission(PAGE, 'can_view'), c.listEmployees);
router.get('/faces/:employeeId/photo', requireHrOrPermission(PAGE, 'can_view'), c.getFacePhoto);
router.post('/faces/:employeeId', requireHrOrPermission(PAGE, 'can_edit'), c.enrollFace);
router.get('/attendance/:employeeId', requireHrOrPermission(PAGE, 'can_view'), c.getAttendanceForCorrection);
router.post('/corrections', requireHrOrPermission(PAGE, 'can_edit'), c.createCorrection);
router.get('/notes', requireHrOrPermission(PAGE, 'can_view'), c.listNotes);
router.get('/logs', requireHrOrPermission(PAGE, 'can_view'), c.getScanLogs);

// ── Admin / Super Admin only ──
router.delete('/faces/:employeeId', requirePermission(PAGE, 'can_delete'), c.removeFace);
router.get('/stats', requirePermission(PAGE, 'can_view'), c.getScanStats);

router.post('/badges/generate-all', requirePermission(PAGE, 'can_edit'), c.generateAllBadges);
router.post('/badges/email-all', requirePermission(PAGE, 'can_edit'), c.emailAllBadges);
router.get('/badges/email-all/status', requirePermission(PAGE, 'can_view'), c.emailAllStatus);
router.get('/badges/:employeeId', requirePermission(PAGE, 'can_view'), c.getBadge);
router.post('/badges/:employeeId/regenerate', requirePermission(PAGE, 'can_edit'), c.regenerateBadge);
router.post('/badges/:employeeId/email', requirePermission(PAGE, 'can_edit'), c.emailBadge);

router.get('/hr-accounts', requirePermission(PAGE, 'can_view'), c.listHrAccounts);
router.post('/hr-accounts', requirePermission(PAGE, 'can_edit'), c.createHrAccount);
router.patch('/hr-accounts/:id', requirePermission(PAGE, 'can_edit'), c.updateHrAccount);
router.delete('/hr-accounts/:id', requirePermission(PAGE, 'can_delete'), c.deleteHrAccount);

router.get('/kiosks', requirePermission(PAGE, 'can_view'), c.listKiosks);
router.post('/kiosks', requirePermission(PAGE, 'can_edit'), c.createKiosk);
router.patch('/kiosks/:id', requirePermission(PAGE, 'can_edit'), c.updateKiosk);
router.delete('/kiosks/:id', requirePermission(PAGE, 'can_delete'), c.deleteKiosk);

router.get('/settings', requirePermission(PAGE, 'can_view'), c.getSettings);
router.put('/settings', requirePermission(PAGE, 'can_edit'), c.updateSettings);

module.exports = router;
