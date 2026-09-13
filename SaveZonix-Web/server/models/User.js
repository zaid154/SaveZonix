const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  FullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  Email: {
    type: String,
    trim: true
  },
  password: {
    type: String
  },
  PasswordHash: {
    type: String
  },
  role: {
    type: String,
    default: 'User'
  },
  Role: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  IsActive: {
    type: Boolean
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
}, { strict: false });

module.exports = mongoose.model('User', UserSchema);
