/**
 * SaveZonix Process-Tracked Download Engine
 * Manages active processes, AbortControllers, format flag enforcement, and instant cancellation
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const DownloadHistory = require('../models/DownloadHistory');

// In-Memory Active Process Tracking Map: downloadId -> { process, abortController, metadata, progress }
const activeProcesses = new Map();

/**
 * Ensures destination downloads folder exists
 */
function getDownloadsDirectory() {
  const home = process.env.USERPROFILE || process.env.HOME || '.';
  const dir = path.join(home, 'Downloads', 'SaveZonix');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * POST /api/downloads/start
 * Payload:
 *  - url: Video / Stream URL
 *  - format: "mp4" | "mp3" | "m4a"
 *  - resolution: "1080p" | "720p" | "480p" | "360p"
 *  - title: Optional video title
 *  - downloadId: Optional client-generated ID
 */
async function startDownload(req, res) {
  const {
    url,
    format = 'mp4',
    resolution = '1080p',
    title = 'media_video',
    downloadId = crypto.randomUUID()
  } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'Media stream URL is required.' });
  }

  const downloadsDir = getDownloadsDirectory();
  const isAudioOnly = format.toLowerCase() === 'mp3' || format.toLowerCase() === 'm4a';
  const audioExt = format.toLowerCase() === 'm4a' ? 'm4a' : 'mp3';
  const targetExt = isAudioOnly ? `.${audioExt}` : '.mp4';
  const safeTitle = (title || 'video').replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 100);
  const outputTemplate = path.join(downloadsDir, `${safeTitle}_%(id)s${targetExt}`);

  // ── Format Flag Enforcement in yt-dlp ──
  const ytArgs = [];

  if (isAudioOnly) {
    // Strictly extract audio track and convert via ffmpeg without video overhead
    ytArgs.push('-f', 'bestaudio/best');
    ytArgs.push('-x');
    ytArgs.push('--audio-format', audioExt);
    ytArgs.push('--audio-quality', '0'); // Best audio VBR
  } else {
    // Strictly pair best mp4 video at requested resolution + best m4a audio and merge
    const height = parseInt(resolution.replace('p', ''), 10) || 1080;
    const formatFilter = `bestvideo[height<=?${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=?${height}][ext=mp4]/best`;
    ytArgs.push('-f', formatFilter);
    ytArgs.push('--merge-output-format', 'mp4');
  }

  ytArgs.push('--no-part');
  ytArgs.push('--newline'); // Clean progress line output for real-time regex parsing
  ytArgs.push('-o', outputTemplate);
  ytArgs.push(url);

  const isWin = process.platform === 'win32';
  const ytDlpCmd = isWin ? 'yt-dlp.exe' : 'yt-dlp';

  const abortController = new AbortController();
  let ytProcess;

  try {
    ytProcess = spawn(ytDlpCmd, ytArgs, {
      signal: abortController.signal,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (spawnErr) {
    return res.status(500).json({
      success: false,
      message: `Failed to spawn yt-dlp process: ${spawnErr.message}`
    });
  }

  const taskMetadata = {
    downloadId,
    url,
    format: isAudioOnly ? audioExt : 'mp4',
    resolution: isAudioOnly ? 'Audio Only' : resolution,
    title: safeTitle,
    status: 'Downloading',
    percentage: 0,
    speed: '0 MB/s',
    eta: '--:--',
    startedAt: new Date()
  };

  const rawSource = req.body.downloadSource || req.body.source || req.headers['x-client-source'] || 'web';
  const downloadSource = String(rawSource).toLowerCase().includes('ext') ? 'extension' : 'web';

  // Register in active processes map
  activeProcesses.set(downloadId, {
    process: ytProcess,
    abortController,
    metadata: { ...taskMetadata, downloadSource }
  });

  // Create initial record in database if MongoDB model is active
  try {
    await DownloadHistory.findOneAndUpdate(
      { taskId: downloadId },
      {
        taskId: downloadId,
        title: safeTitle,
        originalUrl: url,
        platform: url.includes('youtube') || url.includes('youtu.be') ? 'YouTube' : 'Web Stream',
        quality: taskMetadata.resolution,
        format: taskMetadata.format,
        status: 'Downloading',
        downloadType: req.user ? 'user' : 'guest',
        downloadSource: downloadSource,
        source: downloadSource
      },
      { upsert: true, new: true }
    );
  } catch { }

  // Real-time progress output parsing
  ytProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split(/\r?\n/);
    for (const line of lines) {
      // Parse yt-dlp progress: [download]  45.2% of ~120.50MiB at 4.20MiB/s ETA 00:15
      const progressMatch = line.match(/\[download\]\s+([\d\.]+)%\s+of\s+~?([\d\.]+\w+)\s+at\s+([\d\.]+\w+\/s)\s+ETA\s+([\d:]+)/i);
      if (progressMatch) {
        taskMetadata.percentage = parseFloat(progressMatch[1]) || 0;
        taskMetadata.speed = progressMatch[3] || '0 MB/s';
        taskMetadata.eta = progressMatch[4] || '--:--';
        taskMetadata.status = 'Downloading';
      }
    }
  });

  ytProcess.on('close', async (code) => {
    const isCancelled = abortController.signal.aborted || code === null;
    const isSuccess = code === 0 && !isCancelled;
    const finalStatus = isSuccess ? 'Completed' : (isCancelled ? 'Cancelled' : 'Failed');

    taskMetadata.status = finalStatus;
    activeProcesses.delete(downloadId);

    try {
      await DownloadHistory.findOneAndUpdate(
        { taskId: downloadId },
        { status: finalStatus, percentage: isSuccess ? 100 : taskMetadata.percentage }
      );
    } catch { }
  });

  ytProcess.on('error', async (err) => {
    if (abortController.signal.aborted) return;
    taskMetadata.status = 'Failed';
    activeProcesses.delete(downloadId);
    try {
      await DownloadHistory.findOneAndUpdate(
        { taskId: downloadId },
        { status: 'Failed' }
      );
    } catch { }
  });

  return res.status(202).json({
    success: true,
    downloadId,
    status: 'Downloading',
    format: taskMetadata.format,
    resolution: taskMetadata.resolution,
    destination: downloadsDir
  });
}

/**
 * POST /api/downloads/cancel/:id
 * Instantly kills an active download process and updates status to Cancelled
 */
async function cancelDownload(req, res) {
  const downloadId = req.params.id || req.body?.downloadId;

  if (!downloadId) {
    return res.status(400).json({ success: false, message: 'Download ID is required.' });
  }

  const active = activeProcesses.get(downloadId);
  let killed = false;

  if (active) {
    try {
      active.abortController?.abort();
      if (active.process && !active.process.killed) {
        active.process.kill('SIGKILL');
      }
      killed = true;
    } catch { }
    activeProcesses.delete(downloadId);
  }

  try {
    await DownloadHistory.findOneAndUpdate(
      { taskId: downloadId },
      { status: 'Cancelled' }
    );
  } catch { }

  return res.json({
    success: true,
    downloadId,
    cancelled: killed,
    message: 'Download process terminated and state marked Cancelled.'
  });
}

/**
 * POST /api/downloads/cancel-all
 * Global Cancel All action: Kills all running processes across all threads immediately
 */
async function cancelAllDownloads(req, res) {
  let count = 0;

  for (const [id, active] of activeProcesses.entries()) {
    try {
      active.abortController?.abort();
      if (active.process && !active.process.killed) {
        active.process.kill('SIGKILL');
      }
      count++;
    } catch { }
  }

  activeProcesses.clear();

  try {
    await DownloadHistory.updateMany(
      { status: { $in: ['Downloading', 'Pending'] } },
      { $set: { status: 'Cancelled' } }
    );
  } catch { }

  return res.json({
    success: true,
    cancelledCount: count,
    message: `Successfully cancelled all ${count} active running downloads.`
  });
}

/**
 * GET /api/downloads/active
 * Returns live status of all in-progress downloads
 */
function getActiveDownloads(req, res) {
  const list = [];
  for (const [id, item] of activeProcesses.entries()) {
    list.push({
      downloadId: id,
      ...item.metadata
    });
  }
  return res.json({ success: true, count: list.length, downloads: list });
}

/**
 * POST /api/downloads/record
 * Universal endpoint for recording downloads from Web Portal or Chrome Extension
 */
async function recordDownloadTelemetry(req, res) {
  try {
    const {
      taskId = crypto.randomUUID(),
      title,
      fileName,
      originalUrl,
      platform = 'Web Stream',
      quality = '1080p',
      format = 'mp4',
      fileSize = 0,
      downloadSpeedMBps = 0,
      peakSpeedMBps = 0,
      status = 'Completed',
      downloadSource,
      source,
      userEmail,
      userId,
      downloadStrategy
    } = req.body || {};

    const rawSource = downloadSource || source || req.headers['x-client-source'] || 'web';
    const cleanSource = String(rawSource).toLowerCase().includes('ext') ? 'extension' : (String(rawSource).toLowerCase().includes('desk') ? 'desktop' : 'web');

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const email = userEmail && userEmail.trim() ? userEmail.trim() : `Guest (${clientIp})`;

    const record = await DownloadHistory.findOneAndUpdate(
      { taskId },
      {
        $set: {
          taskId,
          title: (title || fileName || 'Media Item').trim(),
          fileName: (fileName || title || 'download.mp4').trim(),
          originalUrl: originalUrl || '',
          platform: platform || 'Web Stream',
          quality: quality || '1080p',
          format: (format || 'mp4').toLowerCase().replace(/^\./, ''),
          fileSize: Math.max(0, Number(fileSize) || 0),
          downloadSpeedMBps: Math.max(0, Number(downloadSpeedMBps) || 0),
          peakSpeedMBps: Math.max(0, Number(peakSpeedMBps) || 0),
          status: status || 'Completed',
          downloadSource: cleanSource,
          source: cleanSource,
          userEmail: email,
          userId: userId || null,
          downloadStrategy: downloadStrategy || (cleanSource === 'extension' ? 'Extension Chunk Worker' : 'Direct Web Download'),
          ipAddress: clientIp,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, record });
  } catch (err) {
    console.error('[Download Telemetry Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  startDownload,
  cancelDownload,
  cancelAllDownloads,
  getActiveDownloads,
  recordDownloadTelemetry,
  activeProcesses
};
