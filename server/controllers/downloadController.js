const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const downloadManager = require('../services/DownloadManager');
const mediaResolver = require('../services/MediaResolver');
const DownloadHistory = require('../models/DownloadHistory');

function sanitizeFileName(name) {
  if (!name) return 'media_' + Date.now();
  return name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 150);
}

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
    let { url } = req.body;
    if (typeof url === 'object' && url !== null) {
      url = url.url || '';
    }
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

/**
 * POST /api/downloads/stream
 * Resolves media and returns direct stream URLs for client-side download (cloud-safe)
 */
async function streamDownload(req, res) {
  try {
    let { url, quality = '1080p' } = req.body;
    if (typeof url === 'object' && url !== null) {
      url = url.url || '';
    }
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    const streamData = await mediaResolver.resolveSpecificStream(url, quality);
    const safeTitle = sanitizeFileName(streamData.title);

    if (streamData.type === 'audio') {
      return res.json({
        success: true,
        type: 'audio',
        title: streamData.title,
        fileName: `${safeTitle}.mp3`,
        streamUrl: streamData.stream.url,
        sizeBytes: streamData.sizeBytes,
        mimeType: streamData.stream.mimeType || 'audio/mp4'
      });
    } else {
      const hasAudio = streamData.videoStream?.hasAudio || false;
      return res.json({
        success: true,
        type: 'video',
        title: streamData.title,
        fileName: `${safeTitle}.mp4`,
        videoStreamUrl: streamData.videoStream.url,
        audioStreamUrl: streamData.audioStream?.url || null,
        videoSize: parseInt(streamData.videoStream.contentLength || '0', 10),
        audioSize: parseInt(streamData.audioStream?.contentLength || '0', 10),
        needsMuxing: !hasAudio && !!streamData.audioStream?.url,
        mimeType: streamData.videoStream.mimeType || 'video/mp4'
      });
    }
  } catch (err) {
    console.error('[DownloadController] streamDownload error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Helper to pipe a remote stream from YouTube CDN to the Express response,
 * following redirects internally (up to 5 hops).
 */
function pipeRemoteStream(targetUrl, req, res, fileName, redirectCount = 0) {
  if (redirectCount > 5) {
    if (!res.headersSent) {
      return res.status(502).json({ success: false, message: 'Too many redirects from CDN edge' });
    }
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    if (!res.headersSent) {
      return res.status(400).json({ success: false, message: 'Invalid remote URL' });
    }
    return;
  }

  const client = parsedUrl.protocol === 'https:' ? https : http;
  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive'
  };

  if (req.headers.range) {
    reqHeaders['Range'] = req.headers.range;
  }

  const proxyReq = client.request({
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: reqHeaders
  }, (proxyRes) => {
    // Follow 3xx redirects internally
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      proxyRes.resume(); // consume response data to free up memory
      return pipeRemoteStream(proxyRes.headers.location, req, res, fileName, redirectCount + 1);
    }

    // Set download headers once connection is established
    const asciiFilename = fileName.replace(/[^\x20-\x7E]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range');

    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    if (proxyRes.headers['content-range']) {
      res.setHeader('Content-Range', proxyRes.headers['content-range']);
    }
    if (proxyRes.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
    }

    res.status(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[ProxyStream] Remote request error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, message: 'Failed to stream from CDN: ' + err.message });
    }
  });

  // 30s connection timeout for initial socket connection
  proxyReq.setTimeout(30000, () => {
    proxyReq.destroy(new Error('Connection timed out connecting to remote CDN'));
  });

  req.on('close', () => {
    proxyReq.destroy();
  });

  proxyReq.end();
}

/**
 * GET /api/downloads/proxy-stream
 * Pipes a YouTube/Google CDN stream through the server to the browser with download headers.
 * Bypasses CORS and forces file download. Used by cloud deployments (Vercel + Render).
 * Query params: ?url=ENCODED_STREAM_URL&filename=ENCODED_FILENAME
 */
async function proxyStream(req, res) {
  try {
    const streamUrl = req.query.url;
    const fileName = decodeURIComponent(req.query.filename || 'download');

    if (!streamUrl) {
      return res.status(400).json({ success: false, message: 'Stream URL is required' });
    }

    // Security: Only allow proxying from YouTube / Google CDN domains
    let parsedUrl;
    try {
      parsedUrl = new URL(streamUrl);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid stream URL' });
    }

    const allowedHosts = [
      'googlevideo.com',
      'youtube.com',
      'ytimg.com',
      'google.com',
      'gvt1.com',
      'ggpht.com',
      'piped.private.coffee',
      'kavin.rocks',
      'adminforge.de'
    ];
    const isAllowed = allowedHosts.some(h => parsedUrl.hostname.endsWith(h));
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Proxy not allowed for this domain' });
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      return res.sendStatus(204);
    }

    pipeRemoteStream(streamUrl, req, res, fileName, 0);
  } catch (err) {
    console.error('[ProxyStream] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = {
  startDownload,
  resolveMedia,
  streamDownload,
  proxyStream,
  getHistory,
  deleteHistoryItem,
  recordDownloadTelemetry,
  cancelDownload: (req, res) => res.json({ success: true }),
  cancelAllDownloads: (req, res) => res.json({ success: true }),
  getActiveDownloads: (req, res) => res.json({ success: true, active: [] })
};
