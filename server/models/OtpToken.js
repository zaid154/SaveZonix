const mongoose = require('mongoose');

const OtpTokenSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  magicTokenHash: {
    type: String,
    default: null
  },
  type: {
    type: String,
    enum: ['register', 'reset'],
    required: true
  },
  tempData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastSentAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Auto-deleted by MongoDB after 10 minutes (600 seconds)
  }
});

module.exports = mongoose.model('OtpToken', OtpTokenSchema);
