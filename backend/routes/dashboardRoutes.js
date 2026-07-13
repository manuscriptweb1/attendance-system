const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');

router.get('/stats', verifyToken, isAdmin, requirePermission('dashboard', 'can_view'), getDashboardStats);

module.exports = router;
