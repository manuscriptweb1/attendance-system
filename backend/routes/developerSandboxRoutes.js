const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
  verifyPin,
  checkSession,
  runSimulation,
  exportReport
} = require('../controllers/developerSandboxController');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_sandbox_secret_key_2026';

/**
 * Middleware: Verify Active Developer Session
 */
function requireDeveloperSession(req, res, next) {
  // Check development environment or sandbox access configuration
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_SANDBOX === 'false') {
    return res.status(403).json({ success: false, message: 'Developer Testing Sandbox is disabled in production' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Developer session expired or required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.isDeveloperSession) {
      return res.status(401).json({ success: false, message: 'Developer session expired or invalid' });
    }
    req.developerSession = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Developer session expired or invalid' });
  }
}

// 1. PIN Verification (Unprotected - verifies PIN)
router.post('/verify-pin', verifyPin);

// 2. Session Check
router.get('/check-session', checkSession);

// 3. Protected Simulation Endpoints
router.post('/simulate', requireDeveloperSession, runSimulation);
router.post('/export', requireDeveloperSession, exportReport);

module.exports = router;
