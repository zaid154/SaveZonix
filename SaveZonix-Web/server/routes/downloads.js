const express = require('express');
const router = express.Router();
const {
  startDownload,
  resolveMedia,
  streamDownload,
  proxyStream,
  getHistory,
  deleteHistoryItem,
  recordDownloadTelemetry,
  cancelDownload,
  cancelAllDownloads,
  getActiveDownloads
} = require('../controllers/downloadController');

// Resolve video/stream details and available qualities
router.post('/resolve', resolveMedia);

// Cloud-safe streaming download (resolve + return direct URLs)
router.post('/stream', streamDownload);

// Proxy YouTube CDN stream to browser with download headers (bypasses CORS)
router.get('/proxy-stream', proxyStream);

// Diagnostic endpoint to empirically test all InnerTube clients on cloud
router.get('/test-clients', async (req, res) => {
  const { Ytdl } = require('@distube/ytdl-core');
  const cookie = process.env.YOUTUBE_COOKIE || undefined;
  const url = req.query.url || 'https://www.youtube.com/shorts/L8XYCkfamfE';
  const results = {};
  for (const name of ['tv', 'visionos', 'web_embedded', 'mweb']) {
    const t0 = Date.now();
    try {
      const y = new Ytdl({ clients: [name], cookie });
      const info = await Promise.race([
        y.getInfo(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 6s')), 6000))
      ]);
      results[name] = { pass: true, timeMs: Date.now() - t0, formats: info.formats.length, title: info.videoDetails?.title };
    } catch (e) {
      results[name] = { pass: false, timeMs: Date.now() - t0, error: e.message };
    }
  }
  res.json({ results, cookieLen: cookie ? cookie.length : 0 });
});

// Start Turbo Download (disk-based, for local engine only)
router.post('/start', startDownload);

// Fetch Download History from MongoDB
router.get('/history', getHistory);
router.delete('/history/:id', deleteHistoryItem);

// Telemetry & Cancel endpoints
router.post('/record', recordDownloadTelemetry);
router.post('/cancel-all', cancelAllDownloads);
router.post('/cancel/:id', cancelDownload);
router.post('/cancel', cancelDownload);
router.get('/active', getActiveDownloads);

module.exports = router;
