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
const { enforceDownloadLimits } = require('../middleware/enforceDownloadLimits');
const { downloadApiLimiter } = require('../middleware/rateLimiter');

// Resolve video/stream details and available qualities
router.post('/resolve', downloadApiLimiter, resolveMedia);

// Cloud-safe streaming download (resolve + return direct URLs, strictly quota enforced)
router.post('/stream', downloadApiLimiter, enforceDownloadLimits, streamDownload);

// Proxy YouTube CDN stream to browser with download headers (bypasses CORS)
router.get('/proxy-stream', proxyStream);

// Start Turbo Download (disk-based, quota enforced)
router.post('/start', downloadApiLimiter, enforceDownloadLimits, startDownload);

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
