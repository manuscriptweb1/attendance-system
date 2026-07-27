const express = require('express');
const router = express.Router();
const { handleBotCommand, getBotCapabilities } = require('../controllers/adminAssistantController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/capabilities', verifyToken, isAdmin, getBotCapabilities);
router.post('/command', verifyToken, isAdmin, handleBotCommand);

module.exports = router;
