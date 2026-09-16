const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AppConfig = require('../models/AppConfig');
const Payment = require('../models/Payment');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'savezonix_default_jwt_secret';

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.user = decoded;
    }
    next();
  });
}

async function getRazorpayKeys() {
  const config = await AppConfig.findOne();
  const keyId = (config && config.razorpayKeyId && config.razorpayKeyId.trim()) || process.env.RAZORPAY_KEY_ID || '';
  const keySecret = (config && config.razorpayKeySecret && config.razorpayKeySecret.trim()) || process.env.RAZORPAY_KEY_SECRET || '';
  return { keyId, keySecret, config };
}

// 1. Create Razorpay Order
router.post('/create-order', optionalAuth, async (req, res) => {
  try {
    const { plan = 'monthly', email, name } = req.body;
    const { keyId, keySecret, config } = await getRazorpayKeys();

    if (!keyId || !keySecret) {
      return res.status(503).json({
        error: 'Razorpay gateway is not configured yet. Configure Key ID and Secret in Admin Settings.'
      });
    }

    let priceINR = 99;
    if (plan === 'annual') {
      priceINR = config?.vipAnnualPriceINR || 799;
    } else if (plan === 'lifetime') {
      priceINR = config?.vipLifetimePriceINR || 1999;
    } else {
      priceINR = config?.vipMonthlyPriceINR || 99;
    }

    let user = null;
    if (req.user && req.user.userId) {
      user = await User.findById(req.user.userId);
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        user = await User.create({
          name: name || email.split('@')[0],
          email: email.toLowerCase(),
          role: 'User',
          isVip: false
        });
      }
    }

    if (!user) {
      return res.status(400).json({ error: 'User account or email is required to initiate payment.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderPayload = {
      amount: Math.round(priceINR * 100),
      currency: 'INR',
      receipt: `sz_${Date.now()}_${user._id.toString().slice(-4)}`,
      notes: {
        userId: user._id.toString(),
        userEmail: user.email,
        plan
      }
    };

    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const rzpOrder = await rzpResponse.json();
    if (!rzpResponse.ok) {
      return res.status(502).json({
        error: rzpOrder.error?.description || 'Failed to create Razorpay order'
      });
    }

    await Payment.create({
      userId: user._id,
      userEmail: user.email,
      userName: user.name || 'Customer',
      orderId: rzpOrder.id,
      amount: priceINR,
      currency: 'INR',
      plan,
      status: 'pending'
    });

    return res.json({
      success: true,
      orderId: rzpOrder.id,
      amount: priceINR,
      currency: 'INR',
      keyId,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      plan
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Verify Payment & Activate VIP
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan = 'monthly',
      userId,
      userEmail,
      method = 'UPI / Online'
    } = req.body;

    const { keySecret } = await getRazorpayKeys();
    if (!keySecret) {
      return res.status(500).json({ error: 'Razorpay secret key is missing' });
    }

    const textToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(textToSign)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: 'failed', updatedAt: new Date() }
      );
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }

    let user = null;
    if (userId) user = await User.findById(userId);
    if (!user && userEmail) user = await User.findOne({ email: userEmail.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const now = new Date();
    let expiresAt = null;
    if (plan === 'monthly') {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (plan === 'annual') {
      expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else if (plan === 'lifetime') {
      expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);
    }

    user.isVip = true;
    user.vipPlan = plan;
    user.vipExpiresAt = expiresAt;
    user.vipPurchasedAt = now;
    await user.save();

    const payment = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'completed',
        paymentMethod: method,
        updatedAt: new Date()
      },
      { new: true }
    );

    const token = jwt.sign(
      { userId: user._id, email: user.email, isVip: true, role: user.role || 'User' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVip: true,
        vipPlan: user.vipPlan,
        vipExpiresAt: user.vipExpiresAt
      },
      payment: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: payment?.amount || 99
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Webhook Listener
router.post('/webhook', async (req, res) => {
  try {
    const { keySecret } = await getRazorpayKeys();
    const webhookSignature = req.headers['x-razorpay-signature'];

    if (keySecret && webhookSignature) {
      const shasum = crypto.createHmac('sha256', keySecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');
      if (digest !== webhookSignature) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const payment = await Payment.findOne({ orderId });
        if (payment && payment.status !== 'completed') {
          payment.status = 'completed';
          payment.paymentId = paymentId;
          payment.updatedAt = new Date();
          await payment.save();

          await User.findByIdAndUpdate(payment.userId, {
            isVip: true,
            vipPlan: payment.plan
          });
        }
      }
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Redeem License Key
router.post('/redeem-license', optionalAuth, async (req, res) => {
  try {
    const { licenseKey, email } = req.body;
    if (!licenseKey || !licenseKey.trim()) {
      return res.status(400).json({ error: 'License key is required.' });
    }

    const cleanKey = licenseKey.trim().toUpperCase();

    const existing = await Payment.findOne({ licenseKey: cleanKey, status: 'completed' });
    if (existing) {
      return res.status(400).json({ error: 'This license key has already been redeemed.' });
    }

    let user = null;
    if (req.user && req.user.userId) {
      user = await User.findById(req.user.userId);
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) {
      return res.status(400).json({ error: 'Please sign in or provide your registered email to redeem.' });
    }

    let plan = 'monthly';
    let durationMs = 30 * 24 * 60 * 60 * 1000;
    if (cleanKey.includes('ANNUAL') || cleanKey.includes('YEAR')) {
      plan = 'annual';
      durationMs = 365 * 24 * 60 * 60 * 1000;
    } else if (cleanKey.includes('LIFE')) {
      plan = 'lifetime';
      durationMs = 100 * 365 * 24 * 60 * 60 * 1000;
    }

    user.isVip = true;
    user.vipPlan = plan;
    user.vipExpiresAt = new Date(Date.now() + durationMs);
    await user.save();

    await Payment.create({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      orderId: `lic_${Date.now()}`,
      amount: 0,
      plan,
      status: 'completed',
      paymentMethod: 'License Key',
      isLicenseKey: true,
      licenseKey: cleanKey
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email, isVip: true, role: user.role || 'User' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      token,
      message: `License key activated successfully. Plan: ${plan}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVip: true,
        vipPlan: user.vipPlan
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
