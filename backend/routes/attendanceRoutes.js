const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isEmployee, requirePermission } = require('../middleware/auth');
const { attendanceRateLimit } = require('../middleware/attendanceRateLimit');
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getEmployeeMonthlyAttendance,
  getAllAttendance,
  getDashboardStats,
  getAbsentEmployees,
  resetAttendance,
  deleteAttendance,
  toggleEarlyCheckout,
  ensureDailyAttendanceRecords,
  clearAttendanceRange
} = require('../controllers/attendanceController');
const { autoCheckoutEmployees } = require('../jobs/autoCheckout');

// Employee routes (with rate limiting)
router.post('/checkin', verifyToken, isEmployee, attendanceRateLimit, checkIn);
router.post('/checkout', verifyToken, isEmployee, attendanceRateLimit, checkOut);
router.get('/today', verifyToken, isEmployee, getTodayAttendance);
router.get('/monthly', verifyToken, isEmployee, getEmployeeMonthlyAttendance);

// Admin routes
// Admin routes
router.get('/all', verifyToken, isAdmin, requirePermission('attendance', 'can_view'), getAllAttendance);
router.get('/stats', verifyToken, isAdmin, requirePermission('dashboard', 'can_view'), getDashboardStats);
router.get('/absent', verifyToken, isAdmin, requirePermission('dashboard', 'can_view'), getAbsentEmployees);
router.post('/reset', verifyToken, isAdmin, requirePermission('attendance', 'can_clear'), resetAttendance);
router.delete('/clear-range', verifyToken, isAdmin, requirePermission('attendance', 'can_clear'), clearAttendanceRange);
router.delete('/:id', verifyToken, isAdmin, requirePermission('attendance', 'can_delete'), deleteAttendance);
router.post('/early-checkout', verifyToken, isAdmin, requirePermission('attendance', 'can_edit'), toggleEarlyCheckout);

// Utility route to create daily absent records manually
router.post('/create-daily-records', verifyToken, isAdmin, requirePermission('attendance', 'can_create'), async (req, res) => {
  try {
    const { date } = req.body;
    const recordsCreated = await ensureDailyAttendanceRecords(date);
    
    res.json({
      success: true,
      message: `Created ${recordsCreated} absent records`,
      recordsCreated
    });
  } catch (error) {
    console.error('Error creating daily records:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating daily records'
    });
  }
});

// Utility route to manually trigger auto-checkout (for testing)
router.post('/trigger-auto-checkout', verifyToken, isAdmin, requirePermission('attendance', 'can_edit'), async (req, res) => {
  try {
    const result = await autoCheckoutEmployees();
    
    res.json({
      success: result.success,
      message: result.message,
      checkedOut: result.checkedOut || 0
    });
  } catch (error) {
    console.error('Error triggering auto-checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering auto-checkout'
    });
  }
});

module.exports = router;
