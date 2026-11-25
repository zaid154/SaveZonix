const mongoose = require('mongoose');

const AppConfigSchema = new mongoose.Schema({
  // App Version & Auto-Update Controls
  latestAppVersion: {
    type: String,
    default: '2.6.1'
  },
  minAllowedVersion: {
    type: String,
    default: '2.0.0'
  },
  forceUpdate: {
    type: Boolean,
    default: false
  },
  gracePeriodDays: {
    type: Number,
    default: 7
  },
  appDownloadUrl: {
    type: String,
    default: 'https://github.com/zaid154/SaveZonix/releases/latest'
  },
  updateChangelog: {
    type: String,
    default: 'High-speed multi-threaded engine, 4K Cinema Player & HLS stream capture.'
  },
  silentAutoUpdate: {
    type: Boolean,
    default: true
  },
  extensionVersion: {
    type: String,
    default: '2.6.1'
  },
  extensionDownloadUrl: {
    type: String,
    default: 'https://savezonix-pro.vercel.app/SaveZonix-Extension.zip'
  },
  chromeWebStoreUrl: {
    type: String,
    default: 'https://chromewebstore.google.com/detail/adblock-for-youtube/cmedhionkhpnakcndndgjdbohmhepckk?hl=en&pli=1'
  },

  // Global Guest & Free Limits
  guestDailyLimit: {
    type: Number,
    default: 3
  },
  guestMaxQuality: {
    type: String,
    default: '720p'
  },
  freeDailyLimit: {
    type: Number,
    default: 3
  },
  freeMaxQuality: {
    type: String,
    default: '720p'
  },
  onQualityExceeded: {
    type: String,
    enum: ['popup', 'downgrade'],
    default: 'popup'
  },

  // Platform & Feature Toggles
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  allowSignups: {
    type: Boolean,
    default: true
  },
  allowPayments: {
    type: Boolean,
    default: true
  },
  platformToggles: {
    youtube: { type: Boolean, default: true },
    instagram: { type: Boolean, default: true },
    tiktok: { type: Boolean, default: true },
    facebook: { type: Boolean, default: true },
    vimeo: { type: Boolean, default: true }
  },
  blockedDomains: {
    type: [String],
    default: []
  },
  maxFileSizeMB: {
    type: Number,
    default: 4096
  },

  // Payment Gateways
  vipMonthlyPriceINR: {
    type: Number,
    default: 99
  },
  vipAnnualPriceINR: {
    type: Number,
    default: 799
  },
  vipLifetimePriceINR: {
    type: Number,
    default: 1999
  },
  razorpayKeyId: {
    type: String,
    default: ''
  },
  razorpayKeySecret: {
    type: String,
    default: ''
  },
  stripePublishableKey: {
    type: String,
    default: ''
  },
  stripeSecretKey: {
    type: String,
    default: ''
  },
  turnstileSiteKey: {
    type: String,
    default: ''
  },
  turnstileSecretKey: {
    type: String,
    default: ''
  },

  announcementMessage: {
    type: String,
    default: ''
  },

  // Engine & Performance Settings
  defaultThreads: {
    type: Number,
    default: 64
  },
  maxThreads: {
    type: Number,
    default: 256
  },
  strictCdnMaxThreads: {
    type: Number,
    default: 32
  },
  hlsChunkConcurrency: {
    type: Number,
    default: 16
  },
  ramCacheMaxMB: {
    type: Number,
    default: 512
  },
  enableTelemetry: {
    type: Boolean,
    default: true
  },
  youtubeCookie: {
    type: String,
    default: ''
  },
  youtubeCookieUpdatedAt: {
    type: Date,
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { strict: false });

module.exports = mongoose.model('AppConfig', AppConfigSchema);
