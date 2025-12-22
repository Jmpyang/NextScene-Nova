const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['monthly', 'annual'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentMethod: {
    type: String,
    enum: ['paypal', 'mpesa'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  // PayPal fields
  paypalOrderId: {
    type: String,
    sparse: true
  },
  paypalCaptureId: {
    type: String,
    sparse: true
  },
  // M-Pesa fields
  mpesaCheckoutRequestID: {
    type: String,
    sparse: true
  },
  mpesaReceiptNumber: {
    type: String,
    sparse: true
  },
  mpesaPhoneNumber: {
    type: String,
    sparse: true
  },
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for faster queries
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ paypalOrderId: 1 });
paymentSchema.index({ mpesaCheckoutRequestID: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

