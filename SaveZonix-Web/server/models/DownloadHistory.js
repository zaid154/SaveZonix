const mongoose = require('mongoose');

const DownloadHistorySchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Media Item'
  },
  fileName: {
    type: String,
    required: true
  },
  quality: {
    type: String,
    default: '1080p'
  },
  fileSize: {
    type: Number,
    default: 0
  },
  format: {
    type: String,
    default: 'mp4'
  },
  status: {
    type: String,
    enum: ['Completed', 'Failed', 'Downloading', 'Corrupted'],
    default: 'Completed'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  userEmail: {
    type: String,
    default: 'guest@savezonix.com'
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DownloadHistory', DownloadHistorySchema);
