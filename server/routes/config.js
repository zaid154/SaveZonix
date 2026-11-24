const express = require('express');
const AppConfig = require('../models/AppConfig');

const router = express.Router();

// Fallback config defaults
const DEFAULT_CONFIG = {
  latestAppVersion: '2.5.6',
  minAllowedVersion: '2.0.0',
  forceUpdate: false,
  gracePeriodDays: 7,
  freeDailyLimit: 10,
  lock4KForVip: true,
  vipMonthlyPriceINR: 99,
  chromeWebStoreUrl: 'https://chromewebstore.google.com/detail/adblock-for-youtube/cmedhionkhpnakcndndgjdbohmhepckk?hl=en&pli=1',
  silentAutoUpdate: true,
  announcementMessage: '',
  defaultThreads: 64,
  DefaultThreads: 64,
  maxThreads: 256,
  MaxThreads: 256,
  strictCdnMaxThreads: 32,
  StrictCdnMaxThreads: 32,
  openCdnMaxThreads: 128,
  registrationEnabled: true,
  RegistrationEnabled: true,
  maintenanceMode: false,
  MaintenanceMode: false
};

// GET /api/app-config - Public endpoint consumed by Desktop App & Landing Site
router.get('/', async (req, res) => {
  try {
    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create(DEFAULT_CONFIG);
    }

    const defaultThreads = Number(config.DefaultThreads || config.defaultThreads || 64);
    const maxThreads = Number(config.MaxThreads || config.maxThreads || config.openCdnMaxThreads || 256);
    const strictCdnMaxThreads = Number(config.StrictCdnMaxThreads || config.strictCdnMaxThreads || 32);
    const registrationEnabled = config.RegistrationEnabled !== undefined ? !!config.RegistrationEnabled : (config.registrationEnabled !== undefined ? !!config.registrationEnabled : true);
    const maintenanceMode = !!(config.MaintenanceMode ?? config.maintenanceMode);

    res.json({
      success: true,
      latestAppVersion: config.latestAppVersion,
      minAllowedVersion: config.minAllowedVersion,
      forceUpdate: config.forceUpdate,
      gracePeriodDays: config.gracePeriodDays,
      freeDailyLimit: config.freeDailyLimit,
      lock4KForVip: config.lock4KForVip,
      vipMonthlyPriceINR: config.vipMonthlyPriceINR,
      chromeWebStoreUrl: config.chromeWebStoreUrl || 'https://chromewebstore.google.com/detail/adblock-for-youtube/cmedhionkhpnakcndndgjdbohmhepckk?hl=en&pli=1',
      appDownloadUrl: config.appDownloadUrl,
      silentAutoUpdate: config.silentAutoUpdate !== false,
      announcementMessage: config.announcementMessage,
      maintenanceMode,
      MaintenanceMode: maintenanceMode,
      maintenanceDurationMinutes: config.maintenanceDurationMinutes || 15,
      maintenanceEndsAt: config.maintenanceEndsAt || null,
      maintenanceMessage: config.maintenanceMessage || 'Server routine upgrade in progress. All stream engines will resume shortly.',
      freeMaxSpeedMBps: config.freeMaxSpeedMBps ?? 15,
      vipMaxSpeedMBps: config.vipMaxSpeedMBps ?? 0,
      defaultThreads,
      DefaultThreads: defaultThreads,
      maxThreads,
      MaxThreads: maxThreads,
      strictCdnMaxThreads,
      StrictCdnMaxThreads: strictCdnMaxThreads,
      openCdnMaxThreads: config.openCdnMaxThreads || 128,
      registrationEnabled,
      RegistrationEnabled: registrationEnabled,
      platformThreadCaps: config.platformThreadCaps || { youtube: 64, instagram: 24, tiktok: 24, directCdn: 128 }
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
