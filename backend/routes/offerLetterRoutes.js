const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin, requirePermission } = require('../middleware/auth');
const {
  getOfferLetters,
  getOfferLetterById,
  createOfferLetter,
  updateOfferLetter,
  generateOfferLetter,
  deleteOfferLetter,
  downloadOfferLetterPDF,
  previewOfferLetterPDF,
  getOfferLetterSettingsHandler,
  updateOfferLetterSettingsHandler,
  resetOfferLetterLogoHandler,
  getRoleTemplates,
  saveRoleTemplate,
  deleteRoleTemplate
} = require('../controllers/offerLetterController');

// All offer letter operations require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// Settings routes (Offer Letter independent branding & footer)
router.get('/settings', requirePermission('offer_letters', 'can_view'), getOfferLetterSettingsHandler);
router.put('/settings', requirePermission('offer_letters', 'can_edit'), updateOfferLetterSettingsHandler);
router.post('/settings/reset-logo', requirePermission('offer_letters', 'can_edit'), resetOfferLetterLogoHandler);

// Role Responsibility Templates routes
router.get('/role-templates', requirePermission('offer_letters', 'can_view'), getRoleTemplates);
router.post('/role-templates', requirePermission('offer_letters', 'can_edit'), saveRoleTemplate);
router.delete('/role-templates/:id', requirePermission('offer_letters', 'can_delete'), deleteRoleTemplate);

// Download / Preview routes
router.get('/:id/download', requirePermission('offer_letters', 'can_export'), downloadOfferLetterPDF);
router.get('/:id/preview', requirePermission('offer_letters', 'can_view'), previewOfferLetterPDF);

// Main Offer Letters CRUD
router.get('/', requirePermission('offer_letters', 'can_view'), getOfferLetters);
router.get('/:id', requirePermission('offer_letters', 'can_view'), getOfferLetterById);
router.post('/', requirePermission('offer_letters', 'can_create'), createOfferLetter);
router.put('/:id', requirePermission('offer_letters', 'can_edit'), updateOfferLetter);
router.post('/:id/generate', requirePermission('offer_letters', 'can_create'), generateOfferLetter);
router.delete('/:id', requirePermission('offer_letters', 'can_delete'), deleteOfferLetter);

module.exports = router;
