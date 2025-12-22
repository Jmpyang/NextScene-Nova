const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { isLoggedIn } = require('../middleware/auth');
const scriptController = require('../controllers/scriptController');
const upload = require('../middleware/upload');

// Validation rules
const scriptValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('genre').optional().isIn(['Drama', 'Comedy', 'Sci-Fi', 'Horror', 'Thriller', 'Romance', 'Action', 'Documentary', 'Short Film', 'Other']).withMessage('Invalid genre'),
  body('pageCount').optional().isInt({ min: 0 }).withMessage('Page count must be a positive number'),
  body('language').optional().trim().notEmpty().withMessage('Language cannot be empty')
];

// List all scripts
router.get('/', scriptController.getAllScripts);

// Create script - with optional file upload
router.post('/create', isLoggedIn, upload.single('scriptFile'), scriptValidation, scriptController.postCreateScript);

// View single script
router.get('/:id', scriptController.getScript);

// Update script
router.post('/:id/edit', isLoggedIn, scriptValidation, scriptController.postUpdateScript);

// Delete script
router.post('/:id/delete', isLoggedIn, scriptController.deleteScript);

// Add rating to script
router.post('/:id/rate', isLoggedIn, scriptController.addRating);

// Like / Unlike script
router.post('/:id/like', isLoggedIn, scriptController.toggleLike);

// Comments
router.get('/:id/comments', scriptController.getComments);
router.post('/:id/comments', isLoggedIn, scriptController.addComment);

// Download script as PDF
router.get('/:id/download', isLoggedIn, scriptController.downloadScriptPDF);

module.exports = router;
