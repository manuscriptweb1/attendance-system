const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isEmployee } = require('../middleware/auth');
const {
  enableWFH,
  disableWFH,
  getWFHStatus
} = require('../controllers/wfhController');

// Admin routes
router.post('/enable', verifyToken, isAdmin, enableWFH);
router.post('/disable', verifyToken, isAdmin, disableWFH);

// Employee route
router.get('/status', verifyToken, isEmployee, getWFHStatus);

module.exports = router;
