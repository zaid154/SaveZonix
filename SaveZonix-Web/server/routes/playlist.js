const express = require('express');
const router = express.Router();
const { fetchPlaylistQueue } = require('../controllers/playlistController');

// Dynamic Playlist Pagination Endpoints (both GET and POST supported)
router.get('/fetch', fetchPlaylistQueue);
router.post('/fetch', fetchPlaylistQueue);
router.post('/load', fetchPlaylistQueue);

module.exports = router;
