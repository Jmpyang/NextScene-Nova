const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['EARN', 'PURCHASE', 'DEDUCTION'],
    required: true
  },
  source: {
    type: String,
    enum: [
      'SIGNUP',
      'LIKE',
      'COMMENT',
      'RATING',
      'AD_WATCH',
      'CONTENT_UPLOAD',
      'PREMIUM_MONTHLY',
      'PREMIUM_YEARLY',
      'COIN_PURCHASE',
      'ADMIN_ADJUSTMENT',
      'VIOLATION_PENALTY',
      'REFUND'
    ],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    default: ''
  },
  referenceId: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient querying
coinTransactionSchema.index({ userId: 1, createdAt: -1 });
coinTransactionSchema.index({ type: 1, source: 1 });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
