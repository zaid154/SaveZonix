const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const AppConfig = require('../models/AppConfig');
const DownloadHistory = require('../models/DownloadHistory');

// Middleware to authenticate admin (by JWT or Master Admin Key)
const adminAuth = async (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const masterKey = process.env.ADMIN_KEY || 'savezonix_admin_2026';

  if (adminKey && adminKey === masterKey) {
    return next();
  }

  // Also check Bearer token if provided
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'savezonix_fallback_secret_key_2026');
      const user = await User.findById(decoded.userId);
      if (user && user.role === 'Admin') {
        req.adminUser = user;
        return next();
      }
    } catch {}
  }

  return res.status(401).json({ error: 'Unauthorized. Admin key or Admin account required.' });
};

// ─────────────────────────────────────────────────────────────
// 1. Overview & Live System Stats
// ─────────────────────────────────────────────────────────────
router.get('/stats', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        totalUsers: 1,
        vipUsers: 1,
        freeUsers: 0,
        totalDownloads: 12,
        todayDownloads: 3,
        bandwidthUsed: '450 MB',
        latestAppVersion: '2.5.0',
        minAllowedVersion: '2.0.0',
        forceUpdate: false,
        serverUptime: Math.floor(process.uptime()),
        dbConnected: false,
        notice: 'Running in offline mode locally. Atlas cluster connects on Render.'
      });
    }

    const totalUsers = await User.countDocuments();
    const vipUsers = await User.countDocuments({ isVip: true });
    const totalDownloads = await DownloadHistory.countDocuments();
    const today = new Date().toISOString().split('T')[0];
    const todayDownloads = await DownloadHistory.countDocuments({
      createdAt: { $gte: new Date(today) }
    });

    // Calculate approximate bandwidth
    const bandwidthAgg = await DownloadHistory.aggregate([
      { $group: { _id: null, totalBytes: { $sum: '$fileSize' } } }
    ]);
    const totalBytes = bandwidthAgg[0]?.totalBytes || 0;
    const bandwidthMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const bandwidthGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

    const config = (await AppConfig.findOne()) || {};

    return res.json({
      totalUsers,
      vipUsers,
      freeUsers: totalUsers - vipUsers,
      totalDownloads,
      todayDownloads,
      bandwidthUsed: totalBytes > 1073741824 ? `${bandwidthGB} GB` : `${bandwidthMB} MB`,
      latestAppVersion: config.latestAppVersion || '2.5.0',
      minAllowedVersion: config.minAllowedVersion || '2.0.0',
      forceUpdate: !!config.forceUpdate,
      serverUptime: Math.floor(process.uptime()),
      dbConnected: true
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. User & VIP Management
// ─────────────────────────────────────────────────────────────
router.get('/users', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([
        {
          _id: 'mock1',
          name: 'Zaid (Admin)',
          email: 'zaidm1323@gmail.com',
          role: 'Admin',
          isVip: true,
          dailyDownloads: 2,
          isActive: true
        }
      ]);
    }

    const search = req.query.search || '';
    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      : {};

    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).limit(100);
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/vip', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.isVip = !user.isVip;
    if (user.isVip) {
      user.vipExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    } else {
      user.vipExpiresAt = null;
    }
    await user.save();

    return res.json({ success: true, isVip: user.isVip, user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/active', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.isActive = !user.isActive;
    await user.save();

    return res.json({ success: true, isActive: user.isActive, user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['Admin', 'User'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.role = role;
    await user.save();

    return res.json({ success: true, role: user.role, user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Downloads History Log
// ─────────────────────────────────────────────────────────────
router.get('/downloads', adminAuth, async (req, res) => {
  try {
    const downloads = await DownloadHistory.find().sort({ createdAt: -1 }).limit(50);
    return res.json(downloads);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. Platform & Engine Settings
// ─────────────────────────────────────────────────────────────
router.get('/settings', adminAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        latestAppVersion: '2.5.0',
        minAllowedVersion: '2.0.0',
        forceUpdate: false,
        gracePeriodDays: 7,
        appDownloadUrl: 'https://github.com/zaid154/SaveZonix/releases/latest',
        updateChangelog: 'High-speed multi-threaded engine & 4K Cinema Player',
        freeDailyLimit: 10,
        lock4KForVip: true,
        vipMonthlyPriceINR: 99,
        announcementMessage: '',
        defaultThreads: 64,
        strictCdnMaxThreads: 32,
        openCdnMaxThreads: 128,
        allowGuestDownloads: true,
        guestDailyDownloadLimit: 10,
        maintenanceMode: false
      });
    }

    let config = await AppConfig.findOne();
    if (!config) {
      config = await AppConfig.create({});
    }
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/settings', adminAuth, async (req, res) => {
  try {
    let config = await AppConfig.findOne();
    if (!config) {
      config = new AppConfig();
    }

    const fields = [
      'latestAppVersion',
      'minAllowedVersion',
      'forceUpdate',
      'gracePeriodDays',
      'appDownloadUrl',
      'updateChangelog',
      'freeDailyLimit',
      'lock4KForVip',
      'vipMonthlyPriceINR',
      'announcementMessage',
      'defaultThreads',
      'strictCdnMaxThreads',
      'openCdnMaxThreads',
      'allowGuestDownloads',
      'guestDailyDownloadLimit',
      'maintenanceMode'
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        config[f] = req.body[f];
      }
    });

    config.updatedAt = new Date();
    await config.save();

    return res.json({ success: true, message: 'Platform settings updated successfully!', config });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
