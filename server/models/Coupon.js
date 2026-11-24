const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: true
  },
  maxUses: {
    type: Number,
    default: 100
  },
  usedCount: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Coupon', CouponSchema);
