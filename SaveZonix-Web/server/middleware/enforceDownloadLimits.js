const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Plan = require('../models/Plan');
const AppConfig = require('../models/AppConfig');
const UsageLog = require('../models/UsageLog');
const { checkUserSubscription } = require('../services/subscriptionService');

const JWT_SECRET = process.env.JWT_SECRET || 'savezonix_default_jwt_secret';

const QUALITY_RANKS = {
  '360p': 1,
  '480p': 2,
  '720p': 3,
  '1080p': 4,
  '1440p': 5,
  '4k': 6,
  '4K': 6,
  '8k': 7,
  '8K': 7
};

/**
 * Calculates start of day (00:00:00) in Indian Standard Time (IST, UTC+5:30)
 */
function getMidnightIST() {
  const now = new Date();
  const istOffsetMs = 330 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  istTime.setUTCHours(0, 0, 0, 0);
  return new Date(istTime.getTime() - istOffsetMs);
}

function getNextMidnightIST() {
  const midnight = getMidnightIST();
  return new Date(midnight.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Core Server-Side Usage Enforcement Gatekeeper Middleware
 */
async function enforceDownloadLimits(req, res, next) {
  try {
    const ip = (
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    ).toString().split(',')[0].trim();

    const fingerprint = (req.headers['x-guest-fingerprint'] || req.query.fingerprint || '').trim();

    // 1. Identify User via JWT
    let user = null;
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.savezonix_token;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.userId) {
          user = await User.findById(decoded.userId);
          if (user) {
            await checkUserSubscription(user);
          }
        }
      } catch {
        // Token invalid or expired, continue as guest
      }
    }

    // 2. Load Global Config
    let config = await AppConfig.findOne();
    if (!config) {
      config = {
        guestDailyLimit: 2,
        guestMaxQuality: '480p',
        freeDailyLimit: 5,
        freeMaxQuality: '720p',
        onQualityExceeded: 'popup'
      };
    }

    // Check Maintenance Mode (Admins bypass)
    const isAdmin = Boolean(
      user && (
        user.role === 'admin' ||
        user.role === 'Admin' ||
        user.email === 'zaidm1323@gmail.com'
      )
    );

    if (config.maintenanceMode && !isAdmin) {
      return res.status(503).json({
        success: false,
        code: 'MAINTENANCE_MODE',
        message: 'SaveZonix is currently undergoing scheduled maintenance. Please check back shortly.'
      });
    }

    // Check Banned User
    if (user && user.isBanned) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_BANNED',
        message: user.bannedReason || 'Your account has been suspended for terms violation.'
      });
    }

    // 3. Resolve Limits & Quota
    let dailyLimit = 2;
    let maxVideoQuality = '480p';
    let maxAudioQuality = 128;
    let playlistAllowed = false;
    let planName = 'Guest';
    let planSlug = 'guest';

    if (isAdmin) {
      dailyLimit = -1; // Unlimited
      maxVideoQuality = '4K';
      maxAudioQuality = 320;
      playlistAllowed = true;
      planName = 'Admin';
      planSlug = 'admin';
    } else if (user) {
      let plan = null;
      if (user.planId) {
        plan = await Plan.findById(user.planId);
      }
      if (!plan) {
        plan = await Plan.findOne({ slug: user.planSlug || 'free' });
      }

      planName = plan?.name || 'Free';
      planSlug = plan?.slug || 'free';

      dailyLimit = user.customDailyLimit !== null && user.customDailyLimit !== undefined
        ? user.customDailyLimit
        : (plan?.dailyDownloadLimit ?? config.freeDailyLimit ?? 5);

      maxVideoQuality = user.customMaxQuality || plan?.maxVideoQuality || config.freeMaxQuality || '720p';
      maxAudioQuality = plan?.maxAudioQuality || 128;
      playlistAllowed = Boolean(plan?.playlistDownload);
    } else {
      // Guest
      dailyLimit = config.guestDailyLimit || 2;
      maxVideoQuality = config.guestMaxQuality || '480p';
      maxAudioQuality = 128;
      playlistAllowed = false;
      planName = 'Guest';
      planSlug = 'guest';
    }

    // 4. Calculate Downloads Used Today since Midnight IST
    const midnightIST = getMidnightIST();
    let usageQuery = {
      status: 'completed',
      timestamp: { $gte: midnightIST }
    };

    if (user) {
      usageQuery.userId = user._id;
    } else if (fingerprint) {
      usageQuery.$or = [
        { guestFingerprint: fingerprint },
        { ipAddress: ip }
      ];
    } else {
      usageQuery.ipAddress = ip;
    }

    const usedToday = await UsageLog.countDocuments(usageQuery);
    const remainingToday = dailyLimit === -1 ? 999999 : Math.max(0, dailyLimit - usedToday);

    // 5. Enforce Daily Limit (if not unlimited)
    if (dailyLimit !== -1 && usedToday >= dailyLimit) {
      return res.status(403).json({
        success: false,
        code: 'LIMIT_REACHED',
        message: user
          ? `You have reached your daily limit of ${dailyLimit} downloads. Upgrade to Pro for unlimited downloads!`
          : `You have reached the guest limit of ${dailyLimit} downloads today. Please Sign In or Upgrade to continue.`,
        dailyLimit,
        usedToday,
        remainingToday: 0,
        planName,
        resetsAt: getNextMidnightIST()
      });
    }

    // 6. Enforce Video Quality Ceiling
    const requestedQuality = (req.body?.quality || req.query?.quality || '720p').toString().toLowerCase();
    const reqRank = QUALITY_RANKS[requestedQuality] || QUALITY_RANKS['720p'];
    const maxRank = QUALITY_RANKS[maxVideoQuality.toLowerCase()] || QUALITY_RANKS['720p'];

    if (reqRank > maxRank) {
      if (config.onQualityExceeded === 'downgrade') {
        req.body.quality = maxVideoQuality;
        req.qualityDowngraded = true;
      } else {
        return res.status(403).json({
          success: false,
          code: 'QUALITY_NOT_ALLOWED',
          message: `${requestedQuality.toUpperCase()} video quality is exclusive to higher plans. Your current plan allows up to ${maxVideoQuality}.`,
          requestedQuality,
          maxAllowedQuality: maxVideoQuality,
          planName
        });
      }
    }

    // Attach verified Auth Metadata to request
    req.authMeta = {
      user,
      isGuest: !user,
      planName,
      planSlug,
      dailyLimit,
      usedToday,
      remainingToday,
      maxVideoQuality,
      maxAudioQuality,
      playlistAllowed,
      ip,
      fingerprint,
      resetsAt: getNextMidnightIST()
    };

    next();
  } catch (err) {
    console.error('[EnforceDownloadLimits] Error:', err);
    next(err);
  }
}

/**
 * Record a completed download to UsageLog
 */
async function recordUsageLog(authMeta, downloadDetails) {
  try {
    const doc = new UsageLog({
      userId: authMeta?.user?._id || null,
      guestFingerprint: authMeta?.fingerprint || null,
      ipAddress: authMeta?.ip || '127.0.0.1',
      url: downloadDetails.url,
      platform: downloadDetails.platform || 'Web Stream',
      quality: downloadDetails.quality || authMeta?.maxVideoQuality || '720p',
      format: downloadDetails.format || 'mp4',
      fileSizeBytes: downloadDetails.fileSizeBytes || 0,
      status: downloadDetails.status || 'completed'
    });
    await doc.save();
    return doc;
  } catch (err) {
    console.warn('[UsageLog] Failed to record download usage:', err.message);
    return null;
  }
}

module.exports = {
  enforceDownloadLimits,
  recordUsageLog,
  getMidnightIST,
  getNextMidnightIST
};
