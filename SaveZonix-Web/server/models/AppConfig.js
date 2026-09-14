const mongoose = require('mongoose');

const AppConfigSchema = new mongoose.Schema({
  // App Version & Auto-Update Controls
  latestAppVersion: {
    type: String,
    default: '2.5.0'
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
    default: '2.5.0'
  },
  extensionDownloadUrl: {
    type: String,
    default: 'https://save-zonix.vercel.app/SaveZonix-Extension.zip'
  },

  // Monetization & Quotas
  freeDailyLimit: {
    type: Number,
    default: 10
  },
  lock4KForVip: {
    type: Boolean,
    default: true
  },
  vipMonthlyPriceINR: {
    type: Number,
    default: 99
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
  strictCdnMaxThreads: {
    type: Number,
    default: 32
  },
  openCdnMaxThreads: {
    type: Number,
    default: 128
  },
  allowGuestDownloads: {
    type: Boolean,
    default: true
  },
  guestDailyDownloadLimit: {
    type: Number,
    default: 10
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AppConfig', AppConfigSchema);
