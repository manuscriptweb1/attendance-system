const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const { getDatabaseMonitorDetails } = require('../controllers/databaseMonitorController');

// All database monitor routes require admin access
router.use(verifyToken, isAdmin);

// GET /api/database/monitor
router.get('/monitor', requirePermission('database_monitor', 'can_view'), getDatabaseMonitorDetails);

module.exports = router;
