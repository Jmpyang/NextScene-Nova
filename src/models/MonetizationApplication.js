const mongoose = require('mongoose');

const monetizationApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
    index: true
  },
  submissionDate: {
    type: Date,
    default: Date.now
  },
  submittedDocuments: [{
    idType: {
      type: String,
      enum: ['NATIONAL_ID', 'DRIVING_LICENSE', 'BIRTH_CERTIFICATE'],
      required: true
    },
    documentUrl: {
      type: String,
      required: true
    },
    documentPublicId: {
      type: String,
      default: null
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING'
    }
  }],
  // Content ownership verification
  contentOwnershipProof: {
    url: String,
    publicId: String,
    uploadedAt: Date,
    documentType: {
      type: String,
      enum: ['COPYRIGHT_CERTIFICATE', 'DECLARATION', 'OTHER'],
      default: 'COPYRIGHT_CERTIFICATE'
    }
  },
  // Reviewer information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewDate: {
    type: Date,
    default: null
  },
  reviewNotes: {
    type: String,
    default: ''
  },
  rejectionReason: {
    type: String,
    enum: [
      'INVALID_DOCUMENTS',
      'UNVERIFIABLE_IDENTITY',
      'PLAGIARISM_DETECTED',
      'COMMUNITY_VIOLATIONS',
      'INCOMPLETE_SUBMISSION',
      'OTHER'
    ],
    default: null
  },
  // Renewal tracking
  lastRenewalDate: {
    type: Date,
    default: null
  },
  nextRenewalRequired: {
    type: Date,
    default: function() {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date;
    }
  },
  renewalStatus: {
    type: String,
    enum: ['ACTIVE', 'PENDING_RENEWAL', 'EXPIRED'],
    default: 'ACTIVE'
  },
  // Monetization approval details
  monthlyMonetizationCap: {
    type: Number,
    default: null,
    min: 0
  },
  coinsRestricted: {
    type: Boolean,
    default: false
  },
  restrictionReason: {
    type: String,
    default: null
  },
  // Appeal tracking
  appealCount: {
    type: Number,
    default: 0,
    max: 3
  },
  lastAppealDate: {
    type: Date,
    default: null
  },
  canAppeal: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
monetizationApplicationSchema.index({ userId: 1 });
monetizationApplicationSchema.index({ status: 1, createdAt: -1 });
monetizationApplicationSchema.index({ nextRenewalRequired: 1 });

module.exports = mongoose.model('MonetizationApplication', monetizationApplicationSchema);
