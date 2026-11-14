const express = require('express');
const router = express.Router();
const { importTabQueue, loadPlaylist } = require('../controllers/playlistController');

// Tab Queue Import from Chrome Extension
router.post('/import-tab-queue', importTabQueue);

// Load and Fetch Playlist endpoints
router.post('/load', loadPlaylist);
router.get('/load', loadPlaylist);
router.post('/fetch', loadPlaylist);
router.get('/fetch', loadPlaylist);

module.exports = router;
