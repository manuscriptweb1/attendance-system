const pool = require('../config/database');
const { getSettingsFromDB } = require('../utils/settingsHelper');
const { getClientIP } = require('../services/networkValidationService');
const { logAudit, AUDIT_ACTIONS, AUDIT_STATUS } = require('../services/auditService');

/**
 * Rate limit middleware for attendance APIs
 */
const attendanceRateLimit = async (req, res, next) => {
  try {
    const employeeId = req.user.employee_id;
    const clientIP = getClientIP(req);
    const settings = await getSettingsFromDB();
    const rateLimit = settings.security?.attendanceRateLimit || 5; // default 5 requests per minute
    
    console.log(`[Rate Limit] Employee: ${employeeId}, IP: ${clientIP}, Limit: ${rateLimit}`);
    
    // Check rate limit
    const result = await pool.query(
      'SELECT * FROM attendance_rate_limits WHERE employee_id = $1 AND ip_address = $2',
      [employeeId, clientIP]
    );
    
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 minute ago
    
    if (result.rows.length === 0) {
      // First request - create record
      console.log(`[Rate Limit] First request for ${employeeId} from ${clientIP} - creating record`);
      await pool.query(
        `INSERT INTO attendance_rate_limits (employee_id, ip_address, request_count, window_start)
         VALUES ($1, $2, 1, CURRENT_TIMESTAMP)`,
        [employeeId, clientIP]
      );
      return next();
    }
    
    const record = result.rows[0];
    const windowStart = new Date(record.window_start);
    
    // Check if window has expired (more than 1 minute old)
    if (windowStart < oneMinuteAgo) {
      // Reset window
      console.log(`[Rate Limit] Window expired for ${employeeId} - resetting count`);
      await pool.query(
        `UPDATE attendance_rate_limits 
         SET request_count = 1, window_start = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [record.id]
      );
      return next();
    }
    
    // Within window - check count
    console.log(`[Rate Limit] Current count: ${record.request_count}/${rateLimit} for ${employeeId}`);
    
    if (record.request_count >= rateLimit) {
      // Rate limit exceeded
      const secondsRemaining = Math.ceil((60000 - (now - windowStart)) / 1000);
      
      console.log(`[Rate Limit] ❌ BLOCKED ${employeeId} - Exceeded limit (${record.request_count}/${rateLimit})`);
      
      // Log security event
      await logAudit({
        userId: employeeId,
        userType: 'employee',
        action: AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
        status: AUDIT_STATUS.FAILED,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        details: { secondsRemaining, requestCount: record.request_count, limit: rateLimit }
      });
      
      return res.status(429).json({
        success: false,
        message: `Too many attendance requests. Please try again in ${secondsRemaining} seconds.`,
        retryAfter: secondsRemaining
      });
    }
    
    // Increment count
    console.log(`[Rate Limit] ✅ Allowed - Incrementing count for ${employeeId} (${record.request_count + 1}/${rateLimit})`);
    await pool.query(
      `UPDATE attendance_rate_limits 
       SET request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [record.id]
    );
    
    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    // Don't block request on rate limit error
    next();
  }
};

module.exports = {
  attendanceRateLimit
};
