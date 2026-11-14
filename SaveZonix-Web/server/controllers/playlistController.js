const crypto = require('crypto');
const PlaylistQueue = require('../models/PlaylistQueue');
const mediaResolver = require('../services/MediaResolver');

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const sec = Math.floor(Number(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * POST /api/playlist/import-tab-queue
 * Called by Chrome Extension to sync live tab items
 */
async function importTabQueue(req, res) {
  try {
    const { title, url, author, items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Queue items array is required.' });
    }

    const queueKey = crypto.randomUUID().replace(/-/g, '');
    const isMix = (url || '').includes('list=RD') || (url || '').includes('start_radio=1');

    const formattedItems = items.map((it, idx) => ({
      index: it.index || idx + 1,
      videoId: it.videoId || it.id || '',
      title: it.title || `Track #${idx + 1}`,
      author: it.author || author || 'YouTube',
      duration: it.duration || '00:00',
      durationSeconds: parseInt(it.durationSeconds || '0', 10),
      thumbnailUrl: it.thumbnailUrl || (it.id ? `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg` : ''),
      isAvailable: true,
      availableQualities: ['4K', '2K', '1080p', '720p', 'MP3'],
      availableFormats: ['MP4', 'WebM', 'MP3', 'M4A']
    }));

    const queueDoc = new PlaylistQueue({
      queueKey,
      url: url || '',
      title: title || 'YouTube Playlist',
      author: author || 'YouTube',
      thumbnailUrl: formattedItems[0]?.thumbnailUrl || '',
      totalKnownVideos: isMix ? 400 : (formattedItems.length >= 25 ? formattedItems.length + 50 : formattedItems.length),
      isMix,
      hasMore: isMix || formattedItems.length >= 25,
      items: formattedItems
    });

    await queueDoc.save();

    return res.json({
      success: true,
      queueKey,
      count: formattedItems.length
    });
  } catch (err) {
    console.error('[PlaylistController] importTabQueue error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/playlist/load or GET/POST /api/playlist/fetch
 */
async function loadPlaylist(req, res) {
  try {
    const queueKey = req.body?.queueKey || req.query?.queueKey;
    const url = (req.body?.url || req.query?.url || '').trim();

    // 1. If queueKey is provided, retrieve from MongoDB
    if (queueKey) {
      const queueDoc = await PlaylistQueue.findOne({ queueKey });
      if (queueDoc) {
        return res.json({
          success: true,
          id: queueDoc.queueKey,
          title: queueDoc.title,
          author: queueDoc.author,
          thumbnailUrl: queueDoc.thumbnailUrl,
          startIndex: 1,
          videoCount: queueDoc.items.length,
          totalKnownVideos: queueDoc.totalKnownVideos,
          hasMore: queueDoc.hasMore,
          isMix: queueDoc.isMix,
          videos: queueDoc.items
        });
      }
    }

    if (!url) {
      return res.status(400).json({ success: false, message: 'Playlist URL or QueueKey is required.' });
    }

    // 2. If it is a single video URL with no list, or direct single URL:
    const isMix = url.includes('list=RD') || url.includes('start_radio=1');
    const singleInfo = await mediaResolver.resolveVideo(url);

    return res.json({
      success: true,
      id: singleInfo.id,
      title: singleInfo.title,
      author: singleInfo.author,
      thumbnailUrl: singleInfo.thumbnailUrl,
      startIndex: 1,
      videoCount: 1,
      totalKnownVideos: isMix ? 25 : 1,
      hasMore: isMix,
      isMix: isMix,
      videos: [{
        index: 1,
        originalIndex: 1,
        videoId: singleInfo.id,
        title: singleInfo.title,
        author: singleInfo.author,
        durationSeconds: singleInfo.durationSeconds,
        formattedDuration: singleInfo.formattedDuration,
        thumbnailUrl: singleInfo.thumbnailUrl,
        url: singleInfo.url,
        isAvailable: true,
        availableQualities: singleInfo.availableQualities,
        availableFormats: singleInfo.availableFormats
      }]
    });

  } catch (err) {
    console.error('[PlaylistController] loadPlaylist error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  importTabQueue,
  loadPlaylist,
  fetchPlaylistQueue: loadPlaylist
};
