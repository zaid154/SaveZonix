const mongoose = require('mongoose');

const EmailLogSchema = new mongoose.Schema({
  recipient: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  templateType: {
    type: String,
    enum: ['register_otp', 'reset_otp', 'security_alert', 'test_diagnostic'],
    required: true
  },
  channel: {
    type: String,
    enum: ['gmail_smtp', 'brevo_api', 'unknown'],
    required: true
  },
  status: {
    type: String,
    enum: ['delivered', 'failed'],
    required: true
  },
  latencyMs: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String,
    default: null
  },
  messageId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // Automatically purge logs after 30 days (30 * 24 * 3600 seconds)
  }
});

module.exports = mongoose.model('EmailLog', EmailLogSchema);
