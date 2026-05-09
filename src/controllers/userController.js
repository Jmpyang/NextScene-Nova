const UserService = require('../models/User');
const ScriptService = require('../models/Script');
const { validationResult } = require('express-validator');

// Show user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    const scripts = await ScriptService.findByAuthor(req.user.id, { limit: 10 });

    res.json({
      success: true,
      profile: user,
      scripts: scripts.scripts
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

    const updateData = {
      name,
      bio: bio || '',
      website: website || '',
      twitter: twitter || '',
      linkedin: linkedin || '',
      phoneNumber: phoneNumber || ''
    };

    // Handle avatar upload (Cloudinary returns URL in req.file.path)
    if (req.file) {
      updateData.avatar = req.file.secure_url || req.file.path;
      console.log('Avatar uploaded successfully:', updateData.avatar);
    }

    const user = await UserService.update(req.user.id, updateData);

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

    // Set expiration date based on plan
    const expiresAt = new Date();
    if (plan === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (plan === 'annual') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    const user = await UserService.update(req.user.id, {
      isPremium: true,
      premiumExpiresAt: expiresAt
    });

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

// Add or remove a script from user's favorites (Note: favorites not in Prisma schema)
exports.toggleFavorite = async (req, res) => {
  try {
    // This functionality would need to be implemented separately
    // as favorites are not in the current Prisma schema
    res.status(501).json({ 
      success: false, 
      message: 'Favorites functionality not implemented in current schema' 
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, message: 'Error updating favorites' });
  }
};

// Show premium content page
exports.getPremiumContent = async (req, res) => {
  try {
    const premiumScripts = await ScriptService.findAll({ 
      status: 'published', 
      isPremiumOnly: true, 
      limit: 20 
    });

    res.json({
      success: true,
      scripts: premiumScripts.scripts
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

    const unverifiedUsers = await UserService.findAll({ 
      isVerified: false,
      isWriter: true,
      role: 'user',
      limit: 100
    });

    res.json({
      success: true,
      users: unverifiedUsers.users
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

    const user = await UserService.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedUser = await UserService.update(req.params.id, {
      isVerified: true
    });

    res.json({
      success: true,
      message: `${user.name} has been verified successfully`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error verifying writer:', error);
    res.status(500).json({ success: false, message: 'Error verifying writer' });
  }
};
