const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { isLoggedIn } = require('../middleware/auth');
const scriptController = require('../controllers/scriptController');
const upload = require('../middleware/upload');

// Validation rules
const scriptValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required')
  // Content validation removed since it can come from file upload
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

module.exports = router;
