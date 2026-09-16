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

    // 3. Realistic Standard Users (3 Users)
    console.log('[Seed] Seeding Realistic Standard Users (3 Users)...');
    const realisticUsers = [
      {
        name: 'Aarav Sharma',
        email: 'aarav.sharma@gmail.com',
        pwd: 'Aarav@SaveZonix#2026!',
        isVip: true,
        vipExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        dailyDownloads: 3,
        totalDownloadsCount: 15
      },
      {
        name: 'Priya Patel',
        email: 'priya.patel@gmail.com',
        pwd: 'Priya@SaveZonix#2026!',
        isVip: false,
        vipExpiresAt: null,
        dailyDownloads: 1,
        totalDownloadsCount: 4
      },
      {
        name: 'Rohan Verma',
        email: 'rohan.verma@gmail.com',
        pwd: 'Rohan@SaveZonix#2026!',
        isVip: false,
        vipExpiresAt: null,
        dailyDownloads: 2,
        totalDownloadsCount: 8
      }
    ];

    const createdUsers = [];
    for (const u of realisticUsers) {
      const uHash = await bcrypt.hash(u.pwd, 10);
      const userDoc = await User.findOneAndUpdate(
        { $or: [{ email: u.email }, { Email: u.email }] },
        {
          name: u.name,
          FullName: u.name,
          email: u.email,
          Email: u.email,
          password: uHash,
          PasswordHash: uHash,
          role: 'User',
          Role: 'User',
          isVip: u.isVip,
          vipExpiresAt: u.vipExpiresAt,
          isActive: true,
          IsActive: true,
          emailConfirmed: true,
          dailyDownloads: u.dailyDownloads,
          totalDownloadsCount: u.totalDownloadsCount
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      createdUsers.push(userDoc);
      console.log(`[Seed] User account (${u.name} - ${u.email}) configured (VIP: ${u.isVip}).`);
    }

    // 4. Realistic Download History Records (3 Records connected to Users)
    console.log('[Seed] Seeding Realistic Download History Records (3 Records)...');
    const sampleDownloads = [
      {
        taskId: 'task_yt_982341',
        title: 'Interstellar - 4K IMAX Docking Scene (Dolby Atmos)',
        fileName: 'Interstellar_4K_IMAX_Docking_Scene.mp4',
        originalUrl: 'https://www.youtube.com/watch?v=a3lcGnMhvsA',
        thumbnailUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
        platform: 'YouTube',
        quality: '4K (2160p)',
        fileSize: 485621000,
        downloadSpeedMBps: 42.8,
        peakSpeedMBps: 58.2,
        format: 'mp4',
        status: 'Completed',
        userId: createdUsers[0]._id,
        userEmail: createdUsers[0].email,
        ipAddress: '127.0.0.1',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        taskId: 'task_ig_551029',
        title: 'Nature Photography Masterclass: Drone 1080p Reel',
        fileName: 'Nature_Photography_Reel_1080p.mp4',
        originalUrl: 'https://www.instagram.com/reel/Cx128AbcdEf/',
        thumbnailUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80',
        platform: 'Instagram',
        quality: '1080p',
        fileSize: 38290000,
        downloadSpeedMBps: 18.4,
        peakSpeedMBps: 24.0,
        format: 'mp4',
        status: 'Completed',
        userId: createdUsers[1]._id,
        userEmail: createdUsers[1].email,
        ipAddress: '127.0.0.1',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
      },
      {
        taskId: 'task_hls_881923',
        title: 'Live Concert Webcast: Orchestral Symphony fMP4 Stream',
        fileName: 'Orchestral_Symphony_Live_Master.mp4',
        originalUrl: 'https://live-stream-cdn.savezonix.net/live/master.m3u8',
        thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        platform: 'Web Stream',
        quality: '1080p',
        fileSize: 194500000,
        downloadSpeedMBps: 31.5,
        peakSpeedMBps: 44.1,
        format: 'mp4',
        status: 'Completed',
        userId: createdUsers[2]._id,
        userEmail: createdUsers[2].email,
        ipAddress: '127.0.0.1',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ];

    for (const d of sampleDownloads) {
      await DownloadHistory.findOneAndUpdate(
        { taskId: d.taskId },
        { $set: d },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`[Seed] Download history record (${d.title}) connected to ${d.userEmail}.`);
    }

    console.log('========================================================');
    console.log('   SaveZonix Web Database Seed Completed Successfully! ');
    console.log(`   - 1 Super Admin & 3 Realistic Users Created/Updated`);
    console.log(`   - 3 Download History Records Created & Connected`);
    console.log('========================================================');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]', err.message);
    process.exit(1);
  }
}

runSeed();
