const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    lowercase: true,
    trim: true,
    required: true
  },
  userName: {
    type: String,
    trim: true,
    default: 'Customer'
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  paymentId: {
    type: String,
    sparse: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  plan: {
    type: String,
    enum: ['monthly', 'annual', 'lifetime'],
    default: 'monthly'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    default: 'unknown'
  },
  razorpaySignature: {
    type: String
  },
  refundId: {
    type: String
  },
  refundedAt: {
    type: Date
  },
  isLicenseKey: {
    type: Boolean,
    default: false
  },
  licenseKey: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', PaymentSchema);
