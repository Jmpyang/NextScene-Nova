const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function () {
      return !this.socialId; // Password required only for local auth
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  // Social authentication fields
  socialId: {
    type: String,
    sparse: true
  },
  provider: {
    type: String,
    enum: ['local', 'facebook', 'google'],
    default: 'local'
  },
  // Premium status
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpiresAt: {
    type: Date
  },
  // Profile fields
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isWriter: {
    type: Boolean,
    default: false
  },
  website: {
    type: String,
    default: ''
  },
  twitter: {
    type: String,
    default: ''
  },
  linkedin: {
    type: String,
    default: ''
  },
  portfolioUrl: {
    type: String,
    default: ''
  },
  // Saved scripts / favorites
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Script'
  }],
  // Has the user accepted the latest Terms & Conditions
  acceptedTermsAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if premium is active
userSchema.methods.isPremiumActive = function () {
  if (!this.isPremium) return false;
  if (!this.premiumExpiresAt) return this.isPremium;
  return this.isPremium && new Date() < this.premiumExpiresAt;
};

module.exports = mongoose.model('User', userSchema);
