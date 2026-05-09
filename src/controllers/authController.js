const passport = require('passport');
const { validationResult } = require('express-validator');
const UserService = require('../models/User');
const CoinTransactionService = require('../models/CoinTransaction');

// Handle registration
exports.postRegister = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { name, email, password, phoneNumber, isWriter, portfolioUrl } = req.body;

  try {
    // Check if user already exists
    const existingUser = await UserService.findByEmail(email.toLowerCase());

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create new user
    const user = await UserService.create({
      name,
      email: email.toLowerCase(),
      password,
      phoneNumber: phoneNumber || '',
      isWriter: isWriter === 'true' || isWriter === true,
      isVerified: true, // Verification requirement removed
      provider: 'local'
    });

    // Award signup bonus
    try {
      await CoinTransactionService.awardCoins(user.id, 10, 'SIGNUP', 'Welcome bonus for signing up!');
    } catch (coinError) {
      console.error('Error awarding signup bonus:', coinError);
      // Don't fail registration if coin system fails
    }

    // Log the user in
    req.login(user, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: 'Error creating session'
        });
      }
      return res.json({
        success: true,
        message: 'Registration successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isWriter: user.isWriter,
          isVerified: user.isVerified,
          isPremium: user.isPremium,
          coins: user.coins
        }
      });
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// Handle login
exports.postLogin = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: info.message || 'Invalid credentials'
      });
    }

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isWriter: user.isWriter,
          isVerified: user.isVerified,
          isPremium: user.isPremium
        }
      });
    });
  })(req, res, next);
};

// Handle logout
exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, message: 'Logout error' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
};

const crypto = require('crypto');
const emailService = require('../config/email');

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const user = await UserService.findByEmail(req.body.email.toLowerCase());

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account with that email found.' });
    }

    // Set token and specific expiration (1 hour)
    const token = crypto.randomBytes(20).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await UserService.update(user.id, {
      resetPasswordToken: token,
      resetPasswordExpires
    });

    // Send real email
    const emailResult = await emailService.sendPasswordResetEmail(user, token, req);
    
    if (!emailResult.success) {
      console.error('Email sending failed:', emailResult.error);
      // Still return success to user to prevent email enumeration attacks
      return res.json({ 
        success: true, 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    res.json({ 
      success: true, 
      message: 'An email has been sent to ' + user.email + ' with further instructions.',
      messageId: emailResult.messageId
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const user = await UserService.findByEmail(req.body.email.toLowerCase());

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires || 
        new Date(user.resetPasswordExpires) < new Date() ||
        user.resetPasswordToken !== req.params.token) {
      return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
    }

    if (req.body.password !== req.body.confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // Set new password
    await UserService.update(user.id, {
      password: req.body.password,
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    // Get updated user data
    const updatedUser = await UserService.findByEmail(user.email);

    // Log the user in
    req.login(updatedUser, (err) => {
      if (err) {
        console.error('Login error after reset:', err);
        return res.status(500).json({ success: false, message: 'Error logging in after password reset' });
      }
      res.json({ success: true, message: 'Success! Your password has been changed.' });
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
