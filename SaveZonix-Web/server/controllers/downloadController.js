const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const downloadManager = require('../services/DownloadManager');
const mediaResolver = require('../services/MediaResolver');
const DownloadHistory = require('../models/DownloadHistory');

/**
 * POST /api/downloads/start
 */
async function startDownload(req, res) {
  try {
    const { url, quality = '1080p', resolution, format = 'mp4' } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    const effectiveQuality = quality || resolution || format;

    // Start download in background and stream progress via Socket.IO
    const downloadPromise = downloadManager.startDownload(url, effectiveQuality, req.user);

    // If client requested synchronous wait (e.g. CLI or automated tests):
    if (req.query?.sync === 'true') {
      const result = await downloadPromise;
      return res.json(result);
    }

    return res.json({
      success: true,
      message: 'Turbo download initiated.',
      url,
      quality: effectiveQuality
    });
  } catch (err) {
    console.error('[DownloadController] startDownload error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/downloads/resolve
 */
async function resolveMedia(req, res) {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'Media URL is required' });
    }

    const metadata = await mediaResolver.resolveVideo(url);
    return res.json({ success: true, ...metadata });
  } catch (err) {
    console.error('[DownloadController] resolveMedia error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/downloads/history
 */
async function getHistory(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '25', 10));
    const search = (req.query.search || '').trim();

    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { fileName: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await DownloadHistory.countDocuments(query);
    const history = await DownloadHistory.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json({
      success: true,
      total,
      page,
      limit,
      history
    });
  } catch (err) {
    console.error('[DownloadController] getHistory error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/downloads/:id
 */
async function deleteHistoryItem(req, res) {
  try {
    const { id } = req.params;
    await DownloadHistory.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Item deleted from history.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/downloads/record (telemetry)
 */
async function recordDownloadTelemetry(req, res) {
  try {
    const doc = new DownloadHistory(req.body);
    await doc.save();
    return res.json({ success: true, id: doc._id });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  startDownload,
  resolveMedia,
  getHistory,
  deleteHistoryItem,
  recordDownloadTelemetry,
  cancelDownload: (req, res) => res.json({ success: true }),
  cancelAllDownloads: (req, res) => res.json({ success: true }),
  getActiveDownloads: (req, res) => res.json({ success: true, active: [] })
};
