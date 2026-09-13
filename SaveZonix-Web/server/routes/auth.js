const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateOtp, sendOtpEmail } = require('../services/emailService');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'savezonix_default_jwt_secret';

// In-memory OTP store (key: email, value: { otp, name, password, expiresAt })
const otpStore = new Map();

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

// ─────────────────────────────────────────────────────────────
// Step 1: Send Registration OTP
// ─────────────────────────────────────────────────────────────
router.post('/send-register-otp', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    otpStore.set(email.toLowerCase(), {
      otp,
      name,
      password: hashedPassword,
      type: 'register',
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    await sendOtpEmail(email, otp, 'register');

    return res.json({ success: true, message: `Verification code sent to ${email}` });
  } catch (err) {
    console.error('[OTP Register Error]', err.message);
    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Step 2: Verify Registration OTP & Create Account
// ─────────────────────────────────────────────────────────────
router.post('/verify-register-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const stored = otpStore.get(email.toLowerCase());
    if (!stored || stored.type !== 'register') {
      return res.status(400).json({ error: 'No pending verification found. Please register again.' });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ error: 'OTP expired. Please request a new code.' });
    }
    if (stored.otp !== otp.toString()) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    // Create user
    const newUser = new User({
      name: stored.name,
      email: email.toLowerCase(),
      password: stored.password
    });
    await newUser.save();
    otpStore.delete(email.toLowerCase());

    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email, isVip: newUser.isVip },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account verified and activated!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isVip: newUser.isVip,
        role: newUser.role,
        dailyDownloads: newUser.dailyDownloads
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Verification failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Login (Direct — no OTP needed)
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Reset daily count if day changed
    const today = new Date().toISOString().split('T')[0];
    if (user.lastDownloadDate !== today) {
      user.dailyDownloads = 0;
      user.lastDownloadDate = today;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, isVip: user.isVip },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVip: user.isVip,
        role: user.role,
        dailyDownloads: user.dailyDownloads
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Send Password Reset OTP
// ─────────────────────────────────────────────────────────────
router.post('/send-reset-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not (security)
      return res.json({ success: true, message: `If ${email} is registered, a reset code has been sent.` });
    }

    const otp = generateOtp();
    otpStore.set(email.toLowerCase(), {
      otp,
      type: 'reset',
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    await sendOtpEmail(email, otp, 'reset');

    return res.json({ success: true, message: `If ${email} is registered, a reset code has been sent.` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send reset code.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Verify Reset OTP & Update Password
// ─────────────────────────────────────────────────────────────
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const stored = otpStore.get(email.toLowerCase());
    if (!stored || stored.type !== 'reset') {
      return res.status(400).json({ error: 'No pending reset found. Please request a new code.' });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ error: 'OTP expired. Please request a new code.' });
    }
    if (stored.otp !== otp.toString()) {
      return res.status(400).json({ error: 'Invalid reset code.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { password: hashedPassword },
      { new: true }
    );

    otpStore.delete(email.toLowerCase());

    const token = jwt.sign(
      { userId: user._id, email: user.email, isVip: user.isVip },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      message: 'Password reset successful! You are now logged in.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVip: user.isVip,
        role: user.role,
        dailyDownloads: user.dailyDownloads
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Password reset failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Get Current User Profile
// ─────────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      isVip: user.isVip,
      role: user.role,
      dailyDownloads: user.dailyDownloads,
      isActive: user.isActive
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
