const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, isEmployee } = require('../middleware/auth');
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
router.get('/all', verifyToken, isAdmin, getAllAttendance);
router.get('/stats', verifyToken, isAdmin, getDashboardStats);
router.get('/absent', verifyToken, isAdmin, getAbsentEmployees);
router.post('/reset', verifyToken, isAdmin, resetAttendance);
router.delete('/clear-range', verifyToken, isAdmin, clearAttendanceRange);
router.delete('/:id', verifyToken, isAdmin, deleteAttendance);
router.post('/early-checkout', verifyToken, isAdmin, toggleEarlyCheckout);

// Utility route to create daily absent records manually
router.post('/create-daily-records', verifyToken, isAdmin, async (req, res) => {
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
router.post('/trigger-auto-checkout', verifyToken, isAdmin, async (req, res) => {
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
