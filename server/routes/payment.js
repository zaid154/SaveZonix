const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AppConfig = require('../models/AppConfig');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Coupon = require('../models/Coupon');
const { activateSubscription } = require('../services/subscriptionService');

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

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) return res.status(403).json({ success: false, message: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

async function getRazorpayKeys() {
  const config = await AppConfig.findOne();
  const keyId = (config && config.razorpayKeyId && config.razorpayKeyId.trim()) || process.env.RAZORPAY_KEY_ID || '';
  const keySecret = (config && config.razorpayKeySecret && config.razorpayKeySecret.trim()) || process.env.RAZORPAY_KEY_SECRET || '';
  return { keyId, keySecret, config };
}

// ─────────────────────────────────────────────────────────────
// 1. Validate & Apply Coupon Code
// ─────────────────────────────────────────────────────────────
router.post('/apply-coupon', async (req, res) => {
  try {
    const { code, planId } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim(), isActive: true });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive coupon code' });
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'This coupon code has expired' });
    }

    if (coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ success: false, message: 'This coupon code usage limit has been reached' });
    }

    let plan = null;
    if (planId) {
      plan = await Plan.findById(planId);
      if (!plan) plan = await Plan.findOne({ slug: planId });
    }

    const originalPrice = plan ? plan.priceINR : 99;
    let discountAmount = 0;

    if (coupon.discountType === 'percentage') {
      discountAmount = (originalPrice * coupon.discountValue) / 100;
    } else {
      discountAmount = Math.min(originalPrice, coupon.discountValue);
    }

    const finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);

    return res.json({
      success: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      originalPrice,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalPrice
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Create Razorpay Order from Dynamic DB Plan
// ─────────────────────────────────────────────────────────────
router.post('/create-order', optionalAuth, async (req, res) => {
  try {
    const { planId = 'pro', plan: legacyPlanName, email, name, couponCode } = req.body;
    const { keyId, keySecret, config } = await getRazorpayKeys();

    if (!keyId || !keySecret) {
      return res.status(503).json({
        error: 'Razorpay gateway is not configured yet. Configure Key ID and Secret in Admin Settings.'
      });
    }

    // Lookup plan from DB
    let plan = null;
    if (planId) {
      if (planId.match(/^[0-9a-fA-F]{24}$/)) {
        plan = await Plan.findById(planId);
      }
      if (!plan) {
        plan = await Plan.findOne({ slug: planId.toLowerCase() });
      }
    }
    if (!plan && legacyPlanName) {
      plan = await Plan.findOne({ slug: legacyPlanName.toLowerCase() });
    }
    if (!plan) {
      plan = await Plan.findOne({ slug: 'pro' }) || {
        _id: null,
        name: 'Pro',
        slug: 'pro',
        priceINR: 99,
        billingPeriod: 'monthly'
      };
    }

    let finalPriceINR = plan.priceINR;

    // Apply Coupon if provided
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim(), isActive: true });
      if (coupon && (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date()) && coupon.usedCount < coupon.maxUses) {
        appliedCoupon = coupon;
        let discount = coupon.discountType === 'percentage'
          ? (finalPriceINR * coupon.discountValue) / 100
          : coupon.discountValue;
        finalPriceINR = Math.max(1, finalPriceINR - discount); // Razorpay minimum order amount is ₹1
      }
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
          role: 'free',
          isVip: false
        });
      }
    }

    if (!user) {
      return res.status(400).json({ error: 'User account or email is required to initiate payment.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderPayload = {
      amount: Math.round(finalPriceINR * 100), // amount in paise
      currency: 'INR',
      receipt: `sz_${Date.now()}_${user._id.toString().slice(-4)}`,
      notes: {
        userId: user._id.toString(),
        userEmail: user.email,
        planId: plan._id ? plan._id.toString() : plan.slug,
        planSlug: plan.slug,
        couponCode: appliedCoupon ? appliedCoupon.code : ''
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
      planId: plan._id,
      orderId: rzpOrder.id,
      amount: finalPriceINR,
      currency: 'INR',
      plan: plan.slug,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      status: 'pending'
    });

    if (appliedCoupon) {
      await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usedCount: 1 } });
    }

    return res.json({
      success: true,
      orderId: rzpOrder.id,
      amount: finalPriceINR,
      currency: 'INR',
      keyId,
      plan: {
        id: plan._id,
        name: plan.name,
        slug: plan.slug,
        priceINR: finalPriceINR
      },
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('[Payment] create-order error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Verify Payment & Activate Plan
// ─────────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      userId,
      userEmail,
      method = 'UPI / Cards'
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

    // Resolve plan
    let plan = null;
    if (planId) {
      if (planId.match(/^[0-9a-fA-F]{24}$/)) plan = await Plan.findById(planId);
      if (!plan) plan = await Plan.findOne({ slug: planId });
    }
    if (!plan) {
      plan = await Plan.findOne({ slug: 'pro' });
    }

    // Activate subscription via subscription service
    const { expiryDate } = await activateSubscription(user._id, plan._id, plan.billingPeriod);

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
      {
        userId: user._id,
        email: user.email,
        role: 'premium',
        planSlug: plan.slug,
        isVip: true
      },
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
        role: 'premium',
        isVip: true,
        plan: {
          id: plan._id,
          name: plan.name,
          slug: plan.slug,
          maxVideoQuality: plan.maxVideoQuality
        },
        vipExpiresAt: expiryDate
      },
      payment: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: payment?.amount || plan.priceINR
      }
    });
  } catch (err) {
    console.error('[Payment] verify error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. Webhook Listener (order.paid, payment.captured, subscription.charged)
// ─────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    const { keySecret } = await getRazorpayKeys();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || keySecret;
    const webhookSignature = req.headers['x-razorpay-signature'];

    if (webhookSecret && webhookSignature) {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');
      if (digest !== webhookSignature) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    console.log(`[Payment Webhook] 🔔 Received event: ${event}`);

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

          if (payment.userId && payment.planId) {
            const plan = await Plan.findById(payment.planId);
            if (plan) {
              await activateSubscription(payment.userId, plan._id, plan.billingPeriod);
              console.log(`[Payment Webhook] ⚡ Activated subscription for user ${payment.userEmail} on plan ${plan.name}`);
            }
          }
        }
      }
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('[Payment Webhook] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. Invoices / Payment History for User Dashboard
// ─────────────────────────────────────────────────────────────
router.get('/invoices', requireAuth, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({
      success: true,
      invoices: payments
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
