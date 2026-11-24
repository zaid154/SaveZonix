const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Plan = require('../models/Plan');
const User = require('../models/User');
const AppConfig = require('../models/AppConfig');

const defaultPlans = [
  {
    name: 'Free',
    slug: 'free',
    priceINR: 0,
    priceUSD: 0,
    billingPeriod: 'monthly',
    dailyDownloadLimit: 5,
    monthlyDownloadLimit: 150,
    maxVideoQuality: '720p',
    maxAudioQuality: 128,
    allowedFormats: ['mp4', 'mp3'],
    playlistDownload: false,
    maxPlaylistItems: 0,
    concurrentDownloads: 1,
    maxFileSizeMB: 500,
    speedPriority: 'standard',
    ads: true,
    isActive: true,
    isPopular: false,
    sortOrder: 1
  },
  {
    name: 'Basic',
    slug: 'basic',
    priceINR: 49,
    priceUSD: 0.99,
    billingPeriod: 'monthly',
    dailyDownloadLimit: 25,
    monthlyDownloadLimit: 500,
    maxVideoQuality: '1080p',
    maxAudioQuality: 192,
    allowedFormats: ['mp4', 'webm', 'mp3', 'm4a'],
    playlistDownload: true,
    maxPlaylistItems: 10,
    concurrentDownloads: 2,
    maxFileSizeMB: 2048,
    speedPriority: 'standard',
    ads: false,
    isActive: true,
    isPopular: false,
    sortOrder: 2
  },
  {
    name: 'Pro',
    slug: 'pro',
    priceINR: 99,
    priceUSD: 1.99,
    billingPeriod: 'monthly',
    dailyDownloadLimit: 100,
    monthlyDownloadLimit: 2000,
    maxVideoQuality: '4K',
    maxAudioQuality: 320,
    allowedFormats: ['mp4', 'webm', 'mp3', 'm4a'],
    playlistDownload: true,
    maxPlaylistItems: 50,
    concurrentDownloads: 5,
    maxFileSizeMB: 10240,
    speedPriority: 'high',
    ads: false,
    isActive: true,
    isPopular: true,
    sortOrder: 3
  },
  {
    name: 'Ultimate',
    slug: 'ultimate',
    priceINR: 199,
    priceUSD: 3.99,
    billingPeriod: 'monthly',
    dailyDownloadLimit: -1, // Unlimited
    monthlyDownloadLimit: -1, // Unlimited
    maxVideoQuality: '4K',
    maxAudioQuality: 320,
    allowedFormats: ['mp4', 'webm', 'mp3', 'm4a'],
    playlistDownload: true,
    maxPlaylistItems: 500,
    concurrentDownloads: 10,
    maxFileSizeMB: 51200,
    speedPriority: 'ultra',
    ads: false,
    isActive: true,
    isPopular: false,
    sortOrder: 4
  }
];

async function seedPlansAndAdmin() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/SaveZonixDb';
  console.log(`[Seed] Connecting to MongoDB: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);

  // 1. Seed or Upsert Plans
  for (const planData of defaultPlans) {
    const existing = await Plan.findOne({ slug: planData.slug });
    if (!existing) {
      await Plan.create(planData);
      console.log(`[Seed] Created plan: ${planData.name} (${planData.slug})`);
    } else {
      console.log(`[Seed] Plan already exists: ${planData.name} (${planData.slug})`);
    }
  }

  const freePlan = await Plan.findOne({ slug: 'free' });
  const ultimatePlan = await Plan.findOne({ slug: 'ultimate' });

  // 2. Seed Superadmin User (zaidm1323@gmail.com)
  const adminEmail = (process.env.ADMIN_EMAIL || 'zaidm1323@gmail.com').toLowerCase();
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@SaveZonix2026', 10);
    await User.create({
      name: 'Super Admin',
      email: adminEmail,
      password: passwordHash,
      role: 'admin',
      isVip: true,
      planId: ultimatePlan?._id || null,
      planSlug: 'ultimate',
      isActive: true,
      customDailyLimit: 999999,
      customMaxQuality: '4K'
    });
    console.log(`[Seed] Seeded Superadmin user: ${adminEmail}`);
  } else {
    existingAdmin.role = 'admin';
    existingAdmin.isVip = true;
    if (ultimatePlan) existingAdmin.planId = ultimatePlan._id;
    existingAdmin.planSlug = 'ultimate';
    await existingAdmin.save();
    console.log(`[Seed] Superadmin updated: ${adminEmail}`);
  }

  // 3. Ensure AppConfig exists with new limits
  let config = await AppConfig.findOne();
  if (!config) {
    config = await AppConfig.create({
      guestDailyLimit: 2,
      guestMaxQuality: '480p',
      freeDailyLimit: 5,
      freeMaxQuality: '720p',
      onQualityExceeded: 'popup',
      vipMonthlyPriceINR: 99,
      vipAnnualPriceINR: 799,
      vipLifetimePriceINR: 1999
    });
    console.log('[Seed] Created default AppConfig');
  }

  console.log('[Seed] Database initialization and default plans seeding complete!');
  await mongoose.disconnect();
}

if (require.main === module) {
  seedPlansAndAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}

module.exports = { seedPlansAndAdmin, defaultPlans };
