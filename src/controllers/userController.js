const User = require('../models/User');
const Script = require('../models/Script');
const { validationResult } = require('express-validator');

// Show user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const scripts = await Script.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      profile: user,
      scripts
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
};

// Update user profile
exports.postUpdateProfile = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, bio } = req.body;

    const user = await User.findById(req.user._id);
    user.name = name;
    user.bio = bio;

    // Handle avatar upload
    if (req.file) {
      user.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};



// Handle premium upgrade (simplified - in production, integrate with payment gateway)
exports.postPremiumUpgrade = async (req, res) => {
  try {
    const { plan } = req.body; // 'monthly' or 'annual'

    const user = await User.findById(req.user._id);

    // Set premium status
    user.isPremium = true;

    // Set expiration date based on plan
    const expiresAt = new Date();
    if (plan === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (plan === 'annual') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    user.premiumExpiresAt = expiresAt;
    await user.save();

    res.json({
      success: true,
      message: 'Upgraded to premium successfully',
      user
    });
  } catch (error) {
    console.error('Error upgrading to premium:', error);
    res.status(500).json({ success: false, message: 'Error upgrading to premium' });
  }
};

// Show premium content page
exports.getPremiumContent = async (req, res) => {
  try {
    const premiumScripts = await Script.find({
      status: 'published',
      isPremiumOnly: true
    })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      scripts: premiumScripts
    });
  } catch (error) {
    console.error('Error fetching premium content:', error);
    res.status(500).json({ success: false, message: 'Error fetching premium content' });
  }
};
