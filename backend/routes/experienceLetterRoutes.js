const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getExperienceLetters,
  getExperienceLetterById,
  createExperienceLetter,
  updateExperienceLetter,
  generateExperienceLetter,
  deleteExperienceLetter,
  downloadExperienceLetterPDF,
  previewExperienceLetterPDF
} = require('../controllers/experienceLetterController');

// All experience letter operations require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// PDF Export & Preview
router.get('/:id/download', requirePermission('offer_letters', 'can_view'), downloadExperienceLetterPDF);
router.get('/:id/preview', requirePermission('offer_letters', 'can_view'), previewExperienceLetterPDF);

// Main Experience Letters CRUD
router.get('/', requirePermission('offer_letters', 'can_view'), getExperienceLetters);
router.get('/:id', requirePermission('offer_letters', 'can_view'), getExperienceLetterById);
router.post('/', requirePermission('offer_letters', 'can_create'), createExperienceLetter);
router.put('/:id', requirePermission('offer_letters', 'can_edit'), updateExperienceLetter);
router.post('/:id/generate', requirePermission('offer_letters', 'can_create'), generateExperienceLetter);
router.delete('/:id', requirePermission('offer_letters', 'can_delete'), deleteExperienceLetter);

module.exports = router;
