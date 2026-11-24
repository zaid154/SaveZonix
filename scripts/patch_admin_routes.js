const fs = require('fs');
const path = require('path');

const adminPath = path.resolve(__dirname, '../server/routes/admin.js');
let code = fs.readFileSync(adminPath, 'utf8');

// 1. Ensure required models are imported at the top
if (!code.includes("require('../models/Plan')")) {
  code = code.replace(
    "const User = require('../models/User');",
    "const User = require('../models/User');\nconst Plan = require('../models/Plan');\nconst UsageLog = require('../models/UsageLog');\nconst Coupon = require('../models/Coupon');\nconst AuditLog = require('../models/AuditLog');\nconst { activateSubscription } = require('../services/subscriptionService');"
  );
}

// 2. Also enhance adminAuth to accept role === 'admin'
code = code.replace(
  "decoded.role === 'Admin'",
  "decoded.role === 'Admin' || decoded.role === 'admin'"
);

const newRoutes = `

// ─────────────────────────────────────────────────────────────
// Audit Log Helper
// ─────────────────────────────────────────────────────────────
async function recordAudit(req, action, targetType, targetId, details = {}) {
  try {
    const adminEmail = req.adminUser?.email || (req.headers['x-admin-key'] ? 'MasterKeyAdmin' : 'Admin');
    const adminId = req.adminUser?._id || req.adminUser?.userId || null;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').toString().split(',')[0].trim();

    await AuditLog.create({
      adminId,
      adminEmail,
      action,
      targetType,
      targetId: targetId ? targetId.toString() : null,
      details,
      ipAddress: ip
    });
  } catch (err) {
    console.warn('[AuditLog] Failed to record audit log:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// A. Plans Management API (CRUD)
// ─────────────────────────────────────────────────────────────
router.get('/plans', adminAuth, async (req, res) => {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1, createdAt: 1 });
    return res.json({ success: true, count: plans.length, plans });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/plans', adminAuth, async (req, res) => {
  try {
    const planData = req.body;
    if (!planData.name || !planData.slug) {
      return res.status(400).json({ success: false, message: 'Plan name and slug are required' });
    }

    const existing = await Plan.findOne({ slug: planData.slug.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A plan with this slug already exists' });
    }

    const plan = await Plan.create({
      ...planData,
      slug: planData.slug.toLowerCase().trim()
    });

    await recordAudit(req, 'PLAN_CREATE', 'Plan', plan._id, { name: plan.name, slug: plan.slug, priceINR: plan.priceINR });
    return res.status(201).json({ success: true, plan });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/plans/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };

    const plan = await Plan.findByIdAndUpdate(id, update, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    await recordAudit(req, 'PLAN_UPDATE', 'Plan', plan._id, { name: plan.name, slug: plan.slug });
    return res.json({ success: true, plan });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/plans/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    // Free plan cannot be deleted
    if (plan.slug === 'free') {
      return res.status(400).json({ success: false, message: 'The default Free plan cannot be deleted.' });
    }

    await Plan.findByIdAndDelete(id);
    await recordAudit(req, 'PLAN_DELETE', 'Plan', id, { slug: plan.slug, name: plan.name });
    return res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// B. User Overrides & Management API
// ─────────────────────────────────────────────────────────────
router.put('/users/:id/plan', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, planSlug, billingPeriod = 'monthly' } = req.body;

    const user = await findUserSafe(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let plan = null;
    if (planId) plan = await Plan.findById(planId);
    if (!plan && planSlug) plan = await Plan.findOne({ slug: planSlug.toLowerCase() });

    if (!plan) return res.status(404).json({ success: false, message: 'Specified plan not found' });

    if (plan.slug === 'free') {
      user.role = 'free';
      user.isVip = false;
      user.planId = plan._id;
      user.planSlug = 'free';
      user.vipExpiresAt = null;
      await user.save();
    } else {
      await activateSubscription(user._id, plan._id, billingPeriod);
    }

    await recordAudit(req, 'USER_PLAN_OVERRIDE', 'User', user._id, { newPlan: plan.slug, email: user.email });
    return res.json({ success: true, message: \`User plan updated to \${plan.name}\`, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id/limits', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { customDailyLimit, customMaxQuality } = req.body;

    const user = await findUserSafe(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.customDailyLimit = customDailyLimit !== undefined ? customDailyLimit : user.customDailyLimit;
    user.customMaxQuality = customMaxQuality !== undefined ? customMaxQuality : user.customMaxQuality;
    await user.save();

    await recordAudit(req, 'USER_LIMITS_OVERRIDE', 'User', user._id, { customDailyLimit, customMaxQuality, email: user.email });
    return res.json({ success: true, message: 'Custom user limits updated', user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/users/:id/reset-usage', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await findUserSafe(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.dailyDownloads = 0;
    await user.save();

    // Remove today's usage logs for user
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    await UsageLog.deleteMany({ userId: user._id, timestamp: { $gte: midnight } });

    await recordAudit(req, 'USER_USAGE_RESET', 'User', user._id, { email: user.email });
    return res.json({ success: true, message: \`Reset today's download usage for \${user.email}\` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id/ban', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned, bannedReason } = req.body;

    const user = await findUserSafe(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isBanned = Boolean(isBanned);
    user.bannedReason = bannedReason || (isBanned ? 'Account suspended by administrator.' : null);
    await user.save();

    await recordAudit(req, isBanned ? 'USER_BAN' : 'USER_UNBAN', 'User', user._id, { email: user.email, reason: user.bannedReason });
    return res.json({ success: true, message: isBanned ? 'User banned successfully' : 'User unbanned successfully', user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users/:id/history', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await findUserSafe(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const logs = await UsageLog.find({ userId: user._id }).sort({ timestamp: -1 }).limit(50);
    return res.json({ success: true, count: logs.length, history: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// C. Coupons Management API (CRUD)
// ─────────────────────────────────────────────────────────────
router.get('/coupons', adminAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.json({ success: true, count: coupons.length, coupons });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/coupons', adminAuth, async (req, res) => {
  try {
    const { code, discountType = 'percentage', discountValue, maxUses = 100, expiresAt } = req.body;
    if (!code || !discountValue) {
      return res.status(400).json({ success: false, message: 'Code and discountValue are required' });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code: cleanCode,
      discountType,
      discountValue: Number(discountValue),
      maxUses: Number(maxUses),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true
    });

    await recordAudit(req, 'COUPON_CREATE', 'Coupon', coupon._id, { code: coupon.code, discountValue });
    return res.status(201).json({ success: true, coupon });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/coupons/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    await recordAudit(req, 'COUPON_DELETE', 'Coupon', id, { code: coupon.code });
    return res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// D. Audit Logs API
// ─────────────────────────────────────────────────────────────
router.get('/audit-logs', adminAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '50', 10));

    const total = await AuditLog.countDocuments();
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({ success: true, total, page, limit, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

`;

// Insert new routes right before module.exports = router;
code = code.replace("module.exports = router;", newRoutes + "\nmodule.exports = router;");

fs.writeFileSync(adminPath, code, 'utf8');
console.log('Successfully patched admin.js with Plans, User Overrides, Coupons, and Audit Logs!');
