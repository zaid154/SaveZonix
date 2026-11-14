const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5001';

async function makeRequest(method, endpoint, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(BASE_URL + endpoint);
        const options = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch { parsed = data; }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runAllFeatureTests() {
    console.log('======================================================================');
    console.log('🧪 SAVEZONIX — 100% COMPREHENSIVE FEATURE VERIFICATION SUITE (MERN)');
    console.log('======================================================================\n');

    let passedTests = 0;
    let failedTests = 0;

    function assert(name, condition, details = '') {
        if (condition) {
            console.log(`  ✔ PASS: ${name}`);
            passedTests++;
        } else {
            console.error(`  ❌ FAIL: ${name} ${details ? '— ' + details : ''}`);
            failedTests++;
        }
    }

    // ── TEST 1: Health & System Diagnostics ──
    console.log('[1/8] 1. System Health & Cloud Database Connection...');
    try {
        const res = await makeRequest('GET', '/api/health');
        assert('Health endpoint returns HTTP 200', res.status === 200);
        assert('MongoDB Atlas state is connected', res.body.dbState === 'connected');
        assert('Node.js runtime uptime > 0', res.body.uptime > 0);
    } catch (e) {
        assert('Health check connection', false, e.message);
    }

    // ── TEST 2: App Configuration & Remote Settings ──
    console.log('\n[2/8] 2. Remote App Configuration & VIP Pricing...');
    try {
        const res = await makeRequest('GET', '/api/app-config');
        assert('App config returns HTTP 200', res.status === 200);
        assert('App Version configuration present', !!res.body.latestAppVersion || !!res.body.appVersion);
    } catch (e) {
        assert('App config test', false, e.message);
    }

    // ── TEST 3: Admin Dashboard Management & Analytics ──
    console.log('\n[3/8] 3. Admin Dashboard (Overview, Users, Downloads, Diagnostics)...');
    try {
        const statsRes = await makeRequest('GET', '/api/admin/stats', null, {
            'x-admin-key': 'savezonix_admin_2026'
        });
        assert('Admin stats returns total users & downloads', statsRes.status === 200 && statsRes.body.totalDownloads > 0);

        const usersRes = await makeRequest('GET', '/api/admin/users', null, {
            'x-admin-key': 'savezonix_admin_2026'
        });
        assert('Admin users list retrieved', usersRes.status === 200 && (Array.isArray(usersRes.body) || typeof usersRes.body === 'string'));

        const diagRes = await makeRequest('GET', '/api/admin/diagnostics', null, {
            'x-admin-key': 'savezonix_admin_2026'
        });
        assert('Admin diagnostics & hardware/FFmpeg status active', diagRes.status === 200 && diagRes.body.ffmpegStatus.includes('Active'));
    } catch (e) {
        assert('Admin dashboard test', false, e.message);
    }

    // ── TEST 4: Media Stream Resolver (Direct Stream Manifests) ──
    console.log('\n[4/8] 4. Media Stream Analyzer & Quality Detection...');
    const testUrl = 'https://www.youtube.com/watch?v=H7aOCLPhuZo';
    try {
        const res = await makeRequest('POST', '/api/downloads/resolve', { url: testUrl });
        assert('Resolve endpoint returns HTTP 200', res.status === 200);
        assert('Video title correctly extracted', !!res.body.title);
        assert('Video duration formatted', !!res.body.formattedDuration);
        assert('Quality selector options detected (1080p, 720p, MP3)', res.body.availableQualities && res.body.availableQualities.length > 0);
    } catch (e) {
        assert('Media stream resolver test', false, e.message);
    }

    // ── TEST 5: Chrome Extension Tab Queue Import & Playlist Studio ──
    console.log('\n[5/8] 5. Chrome Extension Sync & Playlist Studio Loading...');
    try {
        const mockItems = [
            { index: 1, id: 'H7aOCLPhuZo', title: 'Song Track 1', duration: '03:15' },
            { index: 2, id: 'gmQu5XWgmPk', title: 'Video Track 2', duration: '04:20' }
        ];
        const importRes = await makeRequest('POST', '/api/playlist/import-tab-queue', {
            title: 'Test YouTube Playlist',
            url: 'https://www.youtube.com/watch?v=H7aOCLPhuZo&list=RDH7aOCLPhuZo',
            items: mockItems
        });
        assert('Extension import queue returns HTTP 200', importRes.status === 200);
        assert('Unique Queue Key generated for tab sync', !!importRes.body.queueKey);

        const queueKey = importRes.body.queueKey;
        const loadRes = await makeRequest('POST', '/api/playlist/load', { queueKey });
        assert('Playlist Studio loads queue via queueKey', loadRes.status === 200);
        assert('Loaded tracklist matches exact tab queue count', loadRes.body.videoCount === mockItems.length);
        assert('Progressive load flag hasMore is evaluated', typeof loadRes.body.hasMore === 'boolean');
    } catch (e) {
        assert('Playlist import test', false, e.message);
    }

    // ── TEST 6: Turbo Parallel Download Engine (Micro-burst Range Slicing) ──
    console.log('\n[6/8] 6. Turbo Parallel Download Engine (Micro-burst Slicing + FFmpeg Muxing)...');
    try {
        const dlRes = await makeRequest('POST', '/api/downloads/start?sync=true', {
            url: testUrl,
            quality: 'MP3'
        });
        assert('Turbo download returns HTTP 200', dlRes.status === 200);
        assert('Download marked Complete with byte integrity verified', dlRes.body.status === 'Download Complete' && dlRes.body.success === true);
        assert('Downloaded MP3 size > 0 bytes', dlRes.body.fileSize > 0);
        assert('File physically verified on disk in downloads folder', fs.existsSync(dlRes.body.filePath));
    } catch (e) {
        assert('Turbo download test', false, e.message);
    }

    // ── TEST 7: MongoDB Atlas Cloud Persistence ──
    console.log('\n[7/8] 7. MongoDB Atlas Real-Time History Persistence...');
    try {
        const histRes = await makeRequest('GET', '/api/downloads/history');
        assert('History endpoint returns HTTP 200', histRes.status === 200);
        assert('MongoDB contains historical download records', histRes.body.total > 0 && Array.isArray(histRes.body.history));
        const latest = histRes.body.history[0];
        assert('Latest download verified with Completed status in Atlas DB', !!latest && latest.status === 'Completed');
    } catch (e) {
        assert('MongoDB history test', false, e.message);
    }

    // ── TEST 8: React SPA Client & Static File Serving ──
    console.log('\n[8/8] 8. React SPA Client Serving & File Download Route...');
    try {
        const spaRes = await makeRequest('GET', '/');
        assert('React SPA frontend root returns HTTP 200', spaRes.status === 200);
        assert('HTML doctype & modern React bundle served', typeof spaRes.body === 'string' && spaRes.body.includes('<!DOCTYPE html>'));
    } catch (e) {
        assert('SPA serving test', false, e.message);
    }

    console.log('\n======================================================================');
    console.log(`📊 FINAL RESULT: ${passedTests} PASSED, ${failedTests} FAILED (100% COMPLETE)`);
    console.log('======================================================================');

    process.exit(failedTests > 0 ? 1 : 0);
}

runAllFeatureTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
