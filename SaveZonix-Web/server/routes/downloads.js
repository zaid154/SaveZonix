const express = require('express');
const router = express.Router();
const {
  startDownload,
  resolveMedia,
  getHistory,
  deleteHistoryItem,
  recordDownloadTelemetry,
  cancelDownload,
  cancelAllDownloads,
  getActiveDownloads
} = require('../controllers/downloadController');

// Resolve video/stream details and available qualities
router.post('/resolve', resolveMedia);

// Start Turbo Download
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
