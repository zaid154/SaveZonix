const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['User', 'Admin'],
    default: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVip: {
    type: Boolean,
    default: false
  },
  vipExpiresAt: {
    type: Date,
    default: null
  },
  dailyDownloads: {
    type: Number,
    default: 0
  },
  totalDownloadsCount: {
    type: Number,
    default: 0
  },
  lastDownloadDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
