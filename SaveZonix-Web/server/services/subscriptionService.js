const User = require('../models/User');
const Plan = require('../models/Plan');

/**
 * Checks a user's subscription status and automatically downgrades to 'free' if expired.
 */
async function checkUserSubscription(user) {
  if (!user) return null;

  // Superadmin is never downgraded
  if (user.role === 'admin' || user.role === 'Admin') {
    return user;
  }

  // If user has an active premium subscription, check expiration
  if (user.role === 'premium' && user.vipExpiresAt) {
    const expiry = new Date(user.vipExpiresAt);
    if (expiry < new Date()) {
      console.log(`[SubscriptionService] ⏳ Subscription expired for user ${user.email}. Downgrading to Free.`);

      const freePlan = await Plan.findOne({ slug: 'free' });
      user.role = 'free';
      user.isVip = false;
      user.planId = freePlan ? freePlan._id : null;
      user.planSlug = 'free';
      await user.save();
    }
  }

  return user;
}

/**
 * Activate or extend a user's subscription
 */
async function activateSubscription(userId, planId, billingPeriod = 'monthly') {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const plan = await Plan.findById(planId);
  if (!plan) throw new Error('Plan not found');

  const now = new Date();
  let baseDate = now;
  // If user already has an active future expiration, add to it
  if (user.vipExpiresAt && new Date(user.vipExpiresAt) > now) {
    baseDate = new Date(user.vipExpiresAt);
  }

  let expiryDate = new Date(baseDate);
  if (billingPeriod === 'lifetime') {
    expiryDate.setFullYear(expiryDate.getFullYear() + 100);
  } else if (billingPeriod === 'yearly') {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  } else {
    // monthly default
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  }

  user.role = 'premium';
  user.isVip = true;
  user.planId = plan._id;
  user.planSlug = plan.slug;
  user.vipExpiresAt = expiryDate;
  await user.save();

  return { user, plan, expiryDate };
}

module.exports = {
  checkUserSubscription,
  activateSubscription
};
