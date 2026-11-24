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
router.get('/test-net', async (req, res) => {
  const results = {};
  for (const url of ['https://httpbin.org/ip', 'https://www.google.com', 'https://www.youtube.com', 'https://www.youtube.com/sw.js_data']) {
    const t0 = Date.now();
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      results[url] = { ok: resp.ok, status: resp.status, timeMs: Date.now() - t0 };
    } catch (e) {
      results[url] = { ok: false, error: e.message, timeMs: Date.now() - t0 };
    }
  }
  res.json(results);
});

router.get('/test-clients', async (req, res) => {
  const { Ytdl } = require('@distube/ytdl-core');
  const cookie = process.env.YOUTUBE_COOKIE || undefined;
  const url = req.query.url || 'https://www.youtube.com/shorts/L8XYCkfamfE';
  const targetClient = req.query.client || 'tv';
  const t0 = Date.now();
  try {
    const y = new Ytdl({ clients: [targetClient], cookie });
    const info = await Promise.race([
      y.getInfo(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 15s')), 15000))
    ]);
    const f1080 = info.formats.find(f => f.qualityLabel && f.qualityLabel.includes('1080'));
    res.json({
      pass: true,
      client: targetClient,
      timeMs: Date.now() - t0,
      title: info.videoDetails?.title,
      formatsCount: info.formats.length,
      has1080pUrl: Boolean(f1080 && f1080.url),
      sampleUrl: f1080?.url ? f1080.url.substring(0, 60) + '...' : null
    });
  } catch (e) {
    res.status(500).json({
      pass: false,
      client: targetClient,
      timeMs: Date.now() - t0,
      error: e.message,
      stack: e.stack
    });
  }
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
