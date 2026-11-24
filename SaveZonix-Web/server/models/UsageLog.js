const mongoose = require('mongoose');

const UsageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    index: true
  },
  guestFingerprint: {
    type: String,
    default: null,
    index: true
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1',
    index: true
  },
  url: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    default: 'Web Stream'
  },
  quality: {
    type: String,
    default: '720p'
  },
  format: {
    type: String,
    default: 'mp4'
  },
  fileSizeBytes: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['completed', 'failed', 'blocked'],
    default: 'completed',
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for high-velocity daily usage calculation: user/guest + timestamp
UsageLogSchema.index({ userId: 1, timestamp: -1 });
UsageLogSchema.index({ guestFingerprint: 1, timestamp: -1 });
UsageLogSchema.index({ ipAddress: 1, timestamp: -1 });

module.exports = mongoose.model('UsageLog', UsageLogSchema);
