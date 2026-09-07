const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getRelievingLetters,
  getRelievingLetterById,
  createRelievingLetter,
  updateRelievingLetter,
  generateRelievingLetter,
  deleteRelievingLetter,
  downloadRelievingLetterPDF,
  previewRelievingLetterPDF
} = require('../controllers/relievingLetterController');

// All relieving letter operations require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// PDF Export & Preview
router.get('/:id/download', requirePermission('offer_letters', 'can_view'), downloadRelievingLetterPDF);
router.get('/:id/preview', requirePermission('offer_letters', 'can_view'), previewRelievingLetterPDF);

// Main Relieving Letters CRUD
router.get('/', requirePermission('offer_letters', 'can_view'), getRelievingLetters);
router.get('/:id', requirePermission('offer_letters', 'can_view'), getRelievingLetterById);
router.post('/', requirePermission('offer_letters', 'can_create'), createRelievingLetter);
router.put('/:id', requirePermission('offer_letters', 'can_edit'), updateRelievingLetter);
router.post('/:id/generate', requirePermission('offer_letters', 'can_create'), generateRelievingLetter);
router.delete('/:id', requirePermission('offer_letters', 'can_delete'), deleteRelievingLetter);

module.exports = router;
