const express = require('express');
const router = express.Router();
const {
  startDownload,
  cancelDownload,
  cancelAllDownloads,
  getActiveDownloads
} = require('../controllers/downloadController');

// Start download with format flag routing
router.post('/start', startDownload);

// Global Cancel All endpoint
router.post('/cancel-all', cancelAllDownloads);

// Cancel individual download
router.post('/cancel/:id', cancelDownload);
router.post('/cancel', cancelDownload);

// Active downloads monitor endpoint
router.get('/active', getActiveDownloads);

module.exports = router;
