const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const AppConfig = require('../models/AppConfig');
const DownloadHistory = require('../models/DownloadHistory');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/SaveZonixDb';

async function runSeed() {
  console.log('========================================================');
  console.log('   SaveZonix Web - Cloud Database Seeder (MongoDB)');
  console.log('========================================================');

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log(`[Seed] Connected to MongoDB: ${MONGO_URI}`);

    // 1. App Configuration Seed
    console.log('[Seed] Seeding App Config...');
    let config = await AppConfig.findOne();
    if (!config) {
      config = new AppConfig();
    }
    config.latestAppVersion = '2.5.2';
    config.minAllowedVersion = '2.0.0';
    config.forceUpdate = false;
    config.gracePeriodDays = 7;
    config.appDownloadUrl = 'https://github.com/zaid154/SaveZonix/releases/download/v2.5.2/SaveZonix-Setup-v2.5.2.exe';
    config.updateChangelog = 'YouTube 429 rate limit bypass, 1-Click extension folder copy, and fast 4K stream extraction.';
    config.silentAutoUpdate = true;
    config.freeDailyLimit = 10;
    config.lock4KForVip = true;
    config.vipMonthlyPriceINR = 99;
    config.defaultThreads = 64;
    config.strictCdnMaxThreads = 32;
    config.openCdnMaxThreads = 128;
    config.allowGuestDownloads = true;
    config.guestDailyDownloadLimit = 10;
    config.maintenanceMode = false;
    config.updatedAt = new Date();
    await config.save();
    console.log('[Seed] App Config successfully updated to v2.5.2.');

    // 2. Super Admin Account
    console.log('[Seed] Seeding Master Super Admin...');
    const adminEmail = 'zaidm1323@gmail.com';
    const adminHash = await bcrypt.hash('Zaid@SaveZonix#2026!', 10);
    
    await User.findOneAndUpdate(
      { $or: [{ email: adminEmail }, { Email: adminEmail }] },
      {
        name: 'Zaid Khan',
        FullName: 'Zaid Khan',
        email: adminEmail,
        Email: adminEmail,
        password: adminHash,
        role: 'Admin',
        Role: 'Admin',
        isVip: true,
        isActive: true,
        IsActive: true,
        emailConfirmed: true
      },
      { upsert: true, new: true }
    );
    console.log(`[Seed] Super Admin (${adminEmail}) configured.`);

    // 3. Standard Users
    console.log('[Seed] Seeding Standard Users...');
    const standardUsers = [
      { email: 'hadi@gmail.com', name: 'Hadi', pwd: 'Hadi@SaveZonix#2026!' },
      { email: 'dilshad@gmail.com', name: 'Dilshad', pwd: 'Dilshad@SaveZonix#2026!' }
    ];

    for (const u of standardUsers) {
      const uHash = await bcrypt.hash(u.pwd, 10);
      await User.findOneAndUpdate(
        { $or: [{ email: u.email }, { Email: u.email }] },
        {
          name: u.name,
          FullName: u.name,
          email: u.email,
          Email: u.email,
          password: uHash,
          role: 'User',
          Role: 'User',
          isVip: false,
          isActive: true,
          IsActive: true,
          emailConfirmed: true
        },
        { upsert: true, new: true }
      );
      console.log(`[Seed] User account (${u.email}) configured.`);
    }

    // 4. Download History is kept completely clean (0 fake downloads)
    console.log('[Seed] Download telemetry database initialized clean (0 fake records).');

    console.log('========================================================');
    console.log('   SaveZonix Web Database Seed Completed Successfully! ');
    console.log('========================================================');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]', err.message);
    process.exit(1);
  }
}

runSeed();
