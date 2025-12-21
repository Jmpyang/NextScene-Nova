const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { isLoggedIn } = require('../middleware/auth');
const userController = require('../controllers/userController');

// Validation rules
const profileValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('bio').trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters')
];

const avatarUpload = require('../middleware/avatarUpload');

// Profile page
router.get('/profile', isLoggedIn, userController.getProfile);

// Update profile
router.post('/profile', isLoggedIn, avatarUpload.single('avatar'), profileValidation, userController.postUpdateProfile);

module.exports = router;
