const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  priceINR: {
    type: Number,
    required: true,
    default: 0
  },
  priceUSD: {
    type: Number,
    default: 0
  },
  billingPeriod: {
    type: String,
    enum: ['monthly', 'yearly', 'lifetime'],
    default: 'monthly'
  },
  dailyDownloadLimit: {
    type: Number,
    default: 5, // -1 means unlimited
    required: true
  },
  monthlyDownloadLimit: {
    type: Number,
    default: 150, // -1 means unlimited
    required: true
  },
  maxVideoQuality: {
    type: String,
    enum: ['360p', '480p', '720p', '1080p', '1440p', '4K'],
    default: '720p'
  },
  maxAudioQuality: {
    type: Number,
    enum: [128, 192, 320],
    default: 128
  },
  allowedFormats: {
    type: [String],
    default: ['mp4', 'mp3']
  },
  playlistDownload: {
    type: Boolean,
    default: false
  },
  maxPlaylistItems: {
    type: Number,
    default: 0
  },
  concurrentDownloads: {
    type: Number,
    default: 1
  },
  maxFileSizeMB: {
    type: Number,
    default: 500
  },
  speedPriority: {
    type: String,
    enum: ['standard', 'high', 'ultra'],
    default: 'standard'
  },
  ads: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

PlanSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Plan', PlanSchema);
