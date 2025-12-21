const mongoose = require('mongoose');

const scriptSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Premium content flag
  isPremiumOnly: {
    type: Boolean,
    default: false
  },
  // Genre classification
  genre: {
    type: String,
    enum: ['Drama', 'Comedy', 'Sci-Fi', 'Horror', 'Thriller', 'Romance', 'Action', 'Documentary', 'Short Film', 'Other'],
    default: 'Other'
  },
  // Script metadata
  pageCount: {
    type: Number,
    default: 0
  },
  language: {
    type: String,
    default: 'English'
  },
  // Edit tracking (max 3 edits allowed)
  editCount: {
    type: Number,
    default: 0,
    max: 3
  },
  // Rating system
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  // Metadata
  views: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Calculate average rating
scriptSchema.methods.calculateAverageRating = function () {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
    this.totalRatings = 0;
    return;
  }

  const sum = this.ratings.reduce((acc, rating) => acc + rating.rating, 0);
  this.averageRating = sum / this.ratings.length;
  this.totalRatings = this.ratings.length;
};

// Index for searching
scriptSchema.index({ title: 'text', description: 'text', content: 'text' });

module.exports = mongoose.model('Script', scriptSchema);
