const express = require('express');
const router = express.Router();
const passport = require('passport');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { isLoggedOut } = require('../middleware/auth');

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/, "i")
    .withMessage('Password must include one lowercase character, one uppercase character, a number, and a special character'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('phoneNumber').trim().custom((value, { req }) => {
    if (req.body.isWriter === 'true' && !value) {
      throw new Error('Phone number is required for writers');
    }
    return true;
  }),
  body('acceptTerms').custom((value) => {
    // Accept checkbox values from forms (e.g., 'on'), boolean true, or the string 'true'
    if (value !== 'true' && value !== true && value !== 'on' && value !== 'yes') {
      throw new Error('You must accept the Terms & Conditions to create an account');
    }
    return true;
  })
];

const loginValidation = [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Registration routes
// router.get('/register', isLoggedOut, authController.getRegister); // Removed for SPA
router.post('/register', isLoggedOut, registerValidation, authController.postRegister);

// Login routes
// router.get('/login', isLoggedOut, authController.getLogin); // Removed for SPA
router.post('/login', isLoggedOut, loginValidation, authController.postLogin);

// Current User (To check session state on client load)
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ isAuthenticated: true, user: req.user });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// Logout
router.get('/logout', authController.logout);

// Forgot Password
router.post('/forgot', authController.forgotPassword);
router.post('/reset/:token', authController.resetPassword);

// Facebook OAuth
router.get('/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login?error=auth_failed' }),
  (req, res) => {
    res.redirect('/');
  }
);

// Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  (req, res) => {
    res.redirect('/');
  }
);

module.exports = router;
