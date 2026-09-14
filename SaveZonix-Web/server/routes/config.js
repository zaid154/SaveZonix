const express = require('express');
const AppConfig = require('../models/AppConfig');

const router = express.Router();

// Fallback config defaults
const DEFAULT_CONFIG = {
  latestAppVersion: '2.5.0',
  minAllowedVersion: '2.0.0',
  forceUpdate: false,
  gracePeriodDays: 7,
  freeDailyLimit: 10,
  lock4KForVip: true,
  vipMonthlyPriceINR: 99,
  appDownloadUrl: 'https://github.com/zaid154/SaveZonix/releases/download/v2.5.0/SaveZonix-Setup-v2.5.0.exe',
  silentAutoUpdate: true,
  announcementMessage: ''
};

// GET /api/app-config - Public endpoint consumed by Desktop App & Landing Site
router.get('/', async (req, res) => {
  try {
    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create(DEFAULT_CONFIG);
    }
    res.json({
      success: true,
      latestAppVersion: config.latestAppVersion,
      minAllowedVersion: config.minAllowedVersion,
      forceUpdate: config.forceUpdate,
      gracePeriodDays: config.gracePeriodDays,
      freeDailyLimit: config.freeDailyLimit,
      lock4KForVip: config.lock4KForVip,
      vipMonthlyPriceINR: config.vipMonthlyPriceINR,
      appDownloadUrl: config.appDownloadUrl,
      silentAutoUpdate: config.silentAutoUpdate !== false,
      announcementMessage: config.announcementMessage
    });
  } catch (err) {
    // Graceful offline fallback
    res.json({
      success: true,
      ...DEFAULT_CONFIG,
      offlineFallback: true
    });
  }
});

// POST /api/app-config/update - Admin update endpoint
router.post('/update', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== (process.env.ADMIN_KEY || 'savezonix_admin_secret_2026')) {
      return res.status(403).json({ error: 'Unauthorized: Admin key invalid' });
    }

    let config = await AppConfig.findOne();
    if (!config) {
      config = new AppConfig(req.body);
    } else {
      Object.assign(config, req.body);
      config.updatedAt = new Date();
    }

    await config.save();
    res.json({ success: true, message: 'Configuration updated successfully', config });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update config' });
  }
});

module.exports = router;
