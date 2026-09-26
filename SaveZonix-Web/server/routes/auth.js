const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const EmailLog = require('../models/EmailLog');
const {
  generateOtp,
  sendOtpEmail,
  sendSecurityAlertEmail
} = require('../services/emailService');
const {
  checkDisposableEmail,
  createIpRateLimiter,
  hashWithPepper,
  generateSecureToken
} = require('../middleware/securityMiddleware');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'savezonix_default_jwt_secret';

// Sliding-window IP rate limiter for OTP endpoints: max 10 requests per hour per IP
const otpRateLimiter = createIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

// Helper: Extract client metadata for security alerts
function getClientMeta(req) {
  return {
    ip: (
      req.headers['x-forwarded-for'] ||
      req.headers['cf-connecting-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'Unknown IP'
    ).toString().split(',')[0].trim(),
    userAgent: req.headers['user-agent'] || 'Unknown Device/Browser'
  };
}

// Helper: Dynamically determine user's frontend domain (preserves Vercel domain vs local dev)
function getFrontendUrl(req) {
  const origin = req.headers['origin'];
  if (origin && typeof origin === 'string' && origin.startsWith('http')) {
    const clean = origin.replace(/\/+$/, '');
    if (!clean.includes('localhost')) {
      return clean;
    }
  }

  const referer = req.headers['referer'];
  if (referer && typeof referer === 'string' && referer.startsWith('http')) {
    try {
      const u = new URL(referer);
      if (!u.host.includes('localhost')) {
        return `${u.protocol}//${u.host}`;
      }
    } catch { }
  }

  if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost')) {
    return process.env.FRONTEND_URL.replace(/\/+$/, '');
  }

  if (origin && origin.includes('localhost')) {
    return origin.replace(/\/+$/, '');
  }

  return 'https://save-zonix.vercel.app';
}

// ─────────────────────────────────────────────────────────────
// Step 1: Send Registration OTP & 1-Click Magic Link
// ─────────────────────────────────────────────────────────────
router.post('/send-register-otp', otpRateLimiter, checkDisposableEmail, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { Email: normalizedEmail }]
    });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Enforce 60-second cooldown
    const existingOtp = await OtpToken.findOne({ email: normalizedEmail, type: 'register' });
    if (existingOtp && existingOtp.lastSentAt) {
      const elapsedMs = Date.now() - new Date(existingOtp.lastSentAt).getTime();
      if (elapsedMs < 60000) {
        const remainingSec = Math.ceil((60000 - elapsedMs) / 1000);
        return res.status(429).json({
          error: `Please wait ${remainingSec} seconds before requesting another code.`
        });
      }
    }

    // Generate credentials & tokens
    const otp = generateOtp();
    const magicToken = generateSecureToken(32);
    const otpHash = hashWithPepper(otp);
    const magicTokenHash = hashWithPepper(magicToken);

    // Hash password with bcrypt before storing in temporary token data
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Persist to MongoDB OtpToken collection (TTL index auto-cleans in 10 mins)
    await OtpToken.findOneAndUpdate(
      { email: normalizedEmail, type: 'register' },
      {
        email: normalizedEmail,
        otpHash,
        magicTokenHash,
        type: 'register',
        tempData: { name: name.trim(), password: hashedPassword },
        attempts: 0,
        lastSentAt: new Date(),
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Build 1-Click Magic Link
    const frontendUrl = getFrontendUrl(req);
    const magicLink = `${frontendUrl}/?verify_email=${encodeURIComponent(normalizedEmail)}&verify_token=${magicToken}`;

    // Dispatch via Dual-Channel Engine (Gmail SMTP -> Brevo API failover)
    await sendOtpEmail(normalizedEmail, otp, 'register', magicLink);

    return res.json({
      success: true,
      message: `Verification code sent to ${normalizedEmail}. Valid for 10 minutes.`
    });
  } catch (err) {
    console.error('[OTP Register Error]', err.message);
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Step 2: Verify Registration OTP & Activate User
// ─────────────────────────────────────────────────────────────
router.post('/verify-register-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = await OtpToken.findOne({ email: normalizedEmail, type: 'register' });

    if (!record) {
      return res.status(400).json({
        error: 'No pending verification found or code has expired. Please register again.'
      });
    }

    // Check brute-force attempts
    if (record.attempts >= 5) {
      await OtpToken.deleteOne({ _id: record._id });
      return res.status(400).json({
        error: 'Too many incorrect attempts. For security, this verification code has been cancelled. Please request a new one.'
      });
    }

    // Verify HMAC-SHA256 hash
    const inputHash = hashWithPepper(otp.toString().trim());
    if (inputHash !== record.otpHash) {
      record.attempts = (record.attempts || 0) + 1;
      await record.save();
      const remaining = 5 - record.attempts;
      return res.status(400).json({
        error: `Invalid verification code. ${remaining} attempt(s) remaining.`
      });
    }

    // Create verified User
    const newUser = new User({
      name: record.tempData?.name || 'User',
      FullName: record.tempData?.name || 'User',
      email: normalizedEmail,
      Email: normalizedEmail,
      password: record.tempData?.password,
      role: 'User',
      isActive: true,
      isVip: false
    });
    await newUser.save();

    // Clean up temporary OTP record
    await OtpToken.deleteOne({ _id: record._id });

    // Issue JWT token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email, isVip: newUser.isVip, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account verified and activated successfully!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isVip: newUser.isVip,
        role: newUser.role,
        dailyDownloads: newUser.dailyDownloads || 0
      }
    });
  } catch (err) {
    console.error('[Verify Register Error]', err.message);
    return res.status(500).json({ error: err.message || 'Verification failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Step 3: 1-Click Magic Link Verification Handler
// ─────────────────────────────────────────────────────────────
router.post('/magic-verify', async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ error: 'Email and verification token are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = await OtpToken.findOne({ email: normalizedEmail });

    if (!record || !record.magicTokenHash) {
      return res.status(400).json({
        error: 'Verification link is invalid or has expired. Please request a new code.'
      });
    }

    const inputHash = hashWithPepper(token.trim());
    if (inputHash !== record.magicTokenHash) {
      return res.status(400).json({ error: 'Invalid verification link.' });
    }

    if (record.type === 'register') {
      // Create user account
      const newUser = new User({
        name: record.tempData?.name || 'User',
        FullName: record.tempData?.name || 'User',
        email: normalizedEmail,
        Email: normalizedEmail,
        password: record.tempData?.password,
        role: 'User',
        isActive: true,
        isVip: false
      });
      await newUser.save();
      await OtpToken.deleteOne({ _id: record._id });

      const jwtToken = jwt.sign(
        { userId: newUser._id, email: newUser.email, isVip: newUser.isVip, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        type: 'register',
        message: 'Account verified via Magic Link!',
        token: jwtToken,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          isVip: newUser.isVip,
          role: newUser.role
        }
      });
    } else if (record.type === 'reset') {
      // Allow user to proceed directly to entering new password
      return res.json({
        success: true,
        type: 'reset',
        canReset: true,
        email: normalizedEmail,
        message: 'Reset link verified. You may now enter your new password.'
      });
    }

    return res.status(400).json({ error: 'Unknown verification action.' });
  } catch (err) {
    console.error('[Magic Verify Error]', err.message);
    return res.status(500).json({ error: 'Magic link verification failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Step 4: Send Password Reset OTP & Magic Link
// ─────────────────────────────────────────────────────────────
router.post('/send-reset-otp', otpRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: normalizedEmail }, { Email: normalizedEmail }]
    });

    if (!user) {
      // Security: Do not reveal if email exists
      return res.json({
        success: true,
        message: `If ${normalizedEmail} is registered, a password reset code has been sent.`
      });
    }

    // Enforce 60-second cooldown
    const existingOtp = await OtpToken.findOne({ email: normalizedEmail, type: 'reset' });
    if (existingOtp && existingOtp.lastSentAt) {
      const elapsedMs = Date.now() - new Date(existingOtp.lastSentAt).getTime();
      if (elapsedMs < 60000) {
        const remainingSec = Math.ceil((60000 - elapsedMs) / 1000);
        return res.status(429).json({
          error: `Please wait ${remainingSec} seconds before requesting another reset code.`
        });
      }
    }

    // Generate tokens & pepper hashes
    const otp = generateOtp();
    const magicToken = generateSecureToken(32);
    const otpHash = hashWithPepper(otp);
    const magicTokenHash = hashWithPepper(magicToken);

    await OtpToken.findOneAndUpdate(
      { email: normalizedEmail, type: 'reset' },
      {
        email: normalizedEmail,
        otpHash,
        magicTokenHash,
        type: 'reset',
        attempts: 0,
        lastSentAt: new Date(),
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    const frontendUrl = getFrontendUrl(req);
    const magicLink = `${frontendUrl}/?reset_email=${encodeURIComponent(normalizedEmail)}&reset_token=${magicToken}`;

    await sendOtpEmail(normalizedEmail, otp, 'reset', magicLink);

    return res.json({
      success: true,
      message: `If ${normalizedEmail} is registered, a password reset code has been sent.`
    });
  } catch (err) {
    console.error('[Send Reset OTP Error]', err.message);
    return res.status(500).json({ error: 'Failed to send password reset email.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Step 5: Verify Reset OTP & Update Password + Security Alert
// ─────────────────────────────────────────────────────────────
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp, magicToken, newPassword } = req.body;
    if (!email || (!otp && !magicToken) || !newPassword) {
      return res.status(400).json({
        error: 'Email, verification code (or magic token), and new password are required.'
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = await OtpToken.findOne({ email: normalizedEmail, type: 'reset' });

    if (!record) {
      return res.status(400).json({
        error: 'No active reset request found or code has expired. Please request a new code.'
      });
    }

    if (record.attempts >= 5) {
      await OtpToken.deleteOne({ _id: record._id });
      return res.status(400).json({
        error: 'Too many incorrect attempts. This reset code has been cancelled for security.'
      });
    }

    // Verify either via Magic Token or 6-digit OTP
    let isMatch = false;
    if (magicToken && record.magicTokenHash) {
      isMatch = hashWithPepper(magicToken.trim()) === record.magicTokenHash;
    } else if (otp) {
      isMatch = hashWithPepper(otp.toString().trim()) === record.otpHash;
    }

    if (!isMatch) {
      record.attempts = (record.attempts || 0) + 1;
      await record.save();
      const remaining = 5 - record.attempts;
      return res.status(400).json({
        error: `Invalid verification code. ${remaining} attempt(s) remaining.`
      });
    }

    // Hash new password and update User
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findOneAndUpdate(
      { $or: [{ email: normalizedEmail }, { Email: normalizedEmail }] },
      { password: hashedPassword, PasswordHash: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Clean up OTP record
    await OtpToken.deleteOne({ _id: record._id });

    // Send Security Notification Email (Async, non-blocking)
    const clientMeta = getClientMeta(req);
    sendSecurityAlertEmail(user.email, 'Password Reset Completed', clientMeta).catch(() => {});

    // Issue JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, isVip: user.isVip, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      message: 'Password reset successful! You are now logged in.',
      token,
      user: {
        id: user._id,
        name: user.name || user.FullName,
        email: user.email,
        isVip: user.isVip,
        role: user.role,
        dailyDownloads: user.dailyDownloads || 0
      }
    });
  } catch (err) {
    console.error('[Verify Reset Error]', err.message);
    return res.status(500).json({ error: err.message || 'Password reset failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Login (Direct password auth)
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: normalizedEmail }, { Email: normalizedEmail }]
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }
    if (user.isActive === false || user.IsActive === false) {
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
    }

    const targetHash = user.password || user.PasswordHash;
    const isMatch = await bcrypt.compare(password, targetHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isAdmin =
      user.role === 'Admin' ||
      user.Role === 'Admin' ||
      (user.email && user.email.toLowerCase() === 'zaidm1323@gmail.com');

    if (!isAdmin && user.isVip && user.vipExpiresAt && new Date(user.vipExpiresAt) < new Date()) {
      user.isVip = false;
      user.IsVip = false;
      user.vipPlan = 'free';
      await user.save();
    }
    const isVipActive = isAdmin || !!(user.isVip || user.IsVip);

    const today = new Date().toISOString().split('T')[0];
    if (user.lastDownloadDate !== today) {
      user.dailyDownloads = 0;
      user.lastDownloadDate = today;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, isVip: isVipActive, role: isAdmin ? 'Admin' : (user.role || 'User') },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name || user.FullName,
        email: user.email,
        isVip: isVipActive,
        vipPlan: isAdmin ? 'lifetime' : (user.vipPlan || (isVipActive ? 'active' : 'free')),
        vipExpiresAt: isAdmin ? null : user.vipExpiresAt,
        role: isAdmin ? 'Admin' : (user.role || 'User'),
        dailyDownloads: user.dailyDownloads || 0
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Telemetry & Delivery Monitoring (For Admin / Manager)
// ─────────────────────────────────────────────────────────────
router.get('/telemetry/email-stats', authenticateToken, async (req, res) => {
  try {
    const totalDelivered = await EmailLog.countDocuments({ status: 'delivered' });
    const totalFailed = await EmailLog.countDocuments({ status: 'failed' });
    const gmailCount = await EmailLog.countDocuments({ channel: 'gmail_smtp' });
    const brevoCount = await EmailLog.countDocuments({ channel: 'brevo_api' });
    const recentLogs = await EmailLog.find().sort({ createdAt: -1 }).limit(10).lean();

    return res.json({
      success: true,
      stats: {
        totalDelivered,
        totalFailed,
        gmailSmtpDeliveries: gmailCount,
        brevoApiFailovers: brevoCount
      },
      recentLogs
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Get Current User Profile
// ─────────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -PasswordHash');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isAdmin =
      user.role === 'Admin' ||
      user.Role === 'Admin' ||
      (user.email && user.email.toLowerCase() === 'zaidm1323@gmail.com');

    if (!isAdmin && user.isVip && user.vipExpiresAt && new Date(user.vipExpiresAt) < new Date()) {
      user.isVip = false;
      user.IsVip = false;
      user.vipPlan = 'free';
      await user.save();
    }
    const isVipActive = isAdmin || !!(user.isVip || user.IsVip);

    return res.json({
      id: user._id,
      name: user.name || user.FullName,
      email: user.email,
      isVip: isVipActive,
      vipPlan: isAdmin ? 'lifetime' : (user.vipPlan || (isVipActive ? 'active' : 'free')),
      vipExpiresAt: isAdmin ? null : user.vipExpiresAt,
      role: isAdmin ? 'Admin' : (user.role || 'User'),
      dailyDownloads: user.dailyDownloads || 0,
      isActive: user.isActive !== false
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
