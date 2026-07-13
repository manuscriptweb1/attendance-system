const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const { 
  generateMonthlyPDF, 
  generateAdminLogsPDF,
  generateMonthlyMatrixPDF,
  generateMonthlyMatrixExcel
} = require('../controllers/pdfController');

// Legacy: Generate monthly PDF (Admin only)
router.get('/monthly', verifyToken, isAdmin, generateMonthlyPDF);

// NEW: Generate monthly attendance matrix PDF (Admin only)
router.get('/monthly-matrix-pdf', verifyToken, isAdmin, generateMonthlyMatrixPDF);

// NEW: Generate monthly attendance matrix Excel (Admin only)
router.get('/monthly-matrix-excel', verifyToken, isAdmin, generateMonthlyMatrixExcel);

// Generate admin login logs PDF (Admin only)
router.get('/admin-logs', verifyToken, isAdmin, generateAdminLogsPDF);

module.exports = router;
