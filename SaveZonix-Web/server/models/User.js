const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: 'SaveZonix User'
  },
  FullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    required: true,
    index: true
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
    enum: ['guest', 'free', 'premium', 'admin', 'User', 'Admin'],
    default: 'free',
    index: true
  },
  Role: {
    type: String
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null,
    index: true
  },
  planSlug: {
    type: String,
    default: 'free'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  IsActive: {
    type: Boolean
  },
  isBanned: {
    type: Boolean,
    default: false,
    index: true
  },
  bannedReason: {
    type: String,
    default: null
  },
  isVip: {
    type: Boolean,
    default: false
  },
  vipExpiresAt: {
    type: Date,
    default: null
  },
  // Custom admin overrides per user
  customDailyLimit: {
    type: Number,
    default: null // null means inherit from Plan
  },
  customMaxQuality: {
    type: String,
    default: null // null means inherit from Plan
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
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { strict: false });

module.exports = mongoose.model('User', UserSchema);
