const passport = require('passport');
const { validationResult } = require('express-validator');
const User = require('../models/User');

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
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create new user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phoneNumber,
      portfolioUrl: portfolioUrl || '',
      isWriter: isWriter === 'true' || isWriter === true,
      isVerified: isWriter !== 'true' && isWriter !== true, // Readers are verified by default
      provider: 'local'
    });

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
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isWriter: user.isWriter,
          isVerified: user.isVerified
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
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isWriter: user.isWriter,
          isVerified: user.isVerified
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

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account with that email found.' });
    }

    // Generate token
    const token = crypto.randomBytes(20).toString('hex');

    // Set token and specific expiration (1 hour)
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // Mock Email Sending
    console.log('-------------------------------------------');
    console.log(`To: ${user.email}`);
    console.log(`Subject: Password Reset`);
    console.log(`Text: You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
      `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
      `http://${req.headers.host}/reset/${token}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.\n`);
    console.log('-------------------------------------------');

    res.json({ success: true, message: 'An email has been sent to ' + user.email + ' with further instructions.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
    }

    if (req.body.password !== req.body.confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Log the user in
    req.login(user, (err) => {
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
