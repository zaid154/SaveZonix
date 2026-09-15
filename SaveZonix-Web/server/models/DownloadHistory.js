const mongoose = require('mongoose');

const DownloadHistorySchema = new mongoose.Schema({
  taskId: {
    type: String,
    default: null,
    index: true
  },
  title: {
    type: String,
    default: 'Media Item'
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    required: true
  },
  originalUrl: {
    type: String,
    default: ''
  },
  platform: {
    type: String,
    default: 'Web Stream'
  },
  quality: {
    type: String,
    default: '1080p'
  },
  fileSize: {
    type: Number,
    default: 0
  },
  downloadSpeedMBps: {
    type: Number,
    default: 0
  },
  peakSpeedMBps: {
    type: Number,
    default: 0
  },
  format: {
    type: String,
    default: 'mp4'
  },
  status: {
    type: String,
    enum: ['Completed', 'Failed', 'Downloading', 'Corrupted', 'Cancelled'],
    default: 'Completed'
  },
  userId: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  userEmail: {
    type: String,
    default: 'Guest',
    index: true
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('DownloadHistory', DownloadHistorySchema);
