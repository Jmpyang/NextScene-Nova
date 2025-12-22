const User = require('../models/User');
const Script = require('../models/Script');
const { validationResult } = require('express-validator');

// Show user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('favorites', 'title genre createdAt isPremiumOnly');
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
    const { name, bio, website, twitter, linkedin, phoneNumber, portfolioUrl } = req.body;

    const user = await User.findById(req.user._id);
    user.name = name;
    user.bio = bio;
    user.website = website || '';
    user.twitter = twitter || '';
    user.linkedin = linkedin || '';
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.portfolioUrl = portfolioUrl || user.portfolioUrl;

    // Handle avatar upload (Cloudinary returns URL in req.file.path)
    if (req.file) {
      user.avatar = req.file.path;
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

// --- Favorites / Saved scripts ---

// Add or remove a script from user's favorites
exports.toggleFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const scriptId = req.params.id;

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const index = user.favorites.findIndex(id => id.toString() === scriptId);
    let favorited;

    if (index === -1) {
      user.favorites.push(scriptId);
      favorited = true;
      message = 'Added to favorites';
    } else {
      user.favorites.splice(index, 1);
      favorited = false;
      message = 'Removed from favorites';
    }

    await user.save();

    res.json({
      success: true,
      favorited,
      message
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, message: 'Error updating favorites' });
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

// --- Admin Functions ---

// Get list of unverified writers (Admins only)
exports.getUnverifiedWriters = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const unverifiedUsers = await User.find({
      isVerified: false,
      isWriter: true,
      role: 'user'
    }).select('-password').sort({ createdAt: -1 });

    res.json({
      success: true,
      users: unverifiedUsers
    });
  } catch (error) {
    console.error('Error fetching unverified writers:', error);
    res.status(500).json({ success: false, message: 'Error fetching unverified writers' });
  }
};

// Verify a writer (Admins only)
exports.postVerifyWriter = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isVerified = true;
    await user.save();

    res.json({
      success: true,
      message: `${user.name} has been verified successfully`,
      user
    });
  } catch (error) {
    console.error('Error verifying writer:', error);
    res.status(500).json({ success: false, message: 'Error verifying writer' });
  }
};
