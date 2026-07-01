const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const wfhRoutes = require('./routes/wfhRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const securityRoutes = require('./routes/securityRoutes');
const trustedDevicesRoutes = require('./routes/trustedDevicesRoutes');
const adminActivityRoutes = require('./routes/adminActivityRoutes');
const manualAttendanceRoutes = require('./routes/manualAttendanceRoutes');
const absentReasonRoutes = require('./routes/absentReasonRoutes');
const clearDataRoutes = require('./routes/clearDataRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Import cron jobs
const { createDailyAbsentRecords } = require('./jobs/createDailyAbsentRecords');
const { autoCheckoutEmployees } = require('./jobs/autoCheckout');

const app = express();

// CORS Configuration for Production and Development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000' // Allow backend's own domain
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all localhost origins
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    
    // Check against whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      console.log(`✅ Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Desktop-App',
    'X-Device-Source',
    'X-Desktop-Public-Key',
    'X-Desktop-Public-Key-Hash',
    'X-Desktop-Signature',
    'X-Desktop-Timestamp',
    'X-Desktop-Hostname',
    'X-Desktop-Platform',
    'X-Electron-App-Version'
  ]
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
console.log("Auth routes loaded");
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/wfh', wfhRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/trusted-devices', trustedDevicesRoutes);
app.use('/api/admin-activity', adminActivityRoutes);
app.use('/api/manual-attendance', manualAttendanceRoutes);
app.use('/api/absent-reasons', absentReasonRoutes);
app.use('/api/clear-data', clearDataRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  
  // Run auto-checkout check every minute
  cron.schedule('* * * * *', async () => {
    await autoCheckoutEmployees();
  });
  
  // Schedule daily absent records creation - runs at 12:01 AM every day
  cron.schedule('1 0 * * *', async () => {
    console.log('🔄 Running daily absent records job...');
    await createDailyAbsentRecords();
  });
  
  console.log('⏰ Cron jobs scheduled:');
  console.log('   - Auto-checkout: Checks every minute');
  console.log('   - Daily absent records: 12:01 AM daily');
});