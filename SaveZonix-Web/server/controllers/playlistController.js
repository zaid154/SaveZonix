/**
 * SaveZonix YouTube Playlist & Mix Queue Dynamic Controller
 * Handles dynamic pagination, queue fetching, and progressive extraction
 */

const { spawn } = require('child_process');

/**
 * Helper to format seconds into hh:mm:ss or mm:ss
 */
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
 * GET or POST /api/playlist/fetch
 * Query/Body params:
 *  - url: YouTube playlist or mix URL
 *  - startIndex: 1-based index (e.g. 26)
 *  - limit: number of videos to fetch (e.g. 25) or 'all'
 */
async function fetchPlaylistQueue(req, res) {
  const url = (req.query.url || req.body?.url || '').trim();
  const rawStartIndex = req.query.startIndex || req.body?.startIndex || 1;
  const rawLimit = req.query.limit || req.body?.limit || 25;

  if (!url) {
    return res.status(400).json({ success: false, message: 'YouTube playlist or mix URL is required.' });
  }

  const startIndex = Math.max(1, parseInt(rawStartIndex, 10) || 1);
  const isLoadAll = String(rawLimit).toLowerCase() === 'all' || rawLimit === '0' || rawLimit === 0;
  const limitCount = isLoadAll ? null : Math.max(1, parseInt(rawLimit, 10) || 25);
  const endIndex = isLoadAll ? null : (startIndex + limitCount - 1);

  // Build yt-dlp arguments for fast non-download metadata extraction
  const args = [
    '--flat-playlist',
    '--dump-single-json',
    '--no-warnings',
    '--skip-download',
    '--playlist-start', String(startIndex)
  ];

  if (endIndex !== null) {
    args.push('--playlist-end', String(endIndex));
  }

  args.push(url);

  const isWin = process.platform === 'win32';
  const ytDlpCmd = isWin ? 'yt-dlp.exe' : 'yt-dlp';

  let stdoutData = '';
  let stderrData = '';

  const ytProcess = spawn(ytDlpCmd, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  ytProcess.stdout.on('data', (chunk) => {
    stdoutData += chunk.toString();
  });

  ytProcess.stderr.on('data', (chunk) => {
    stderrData += chunk.toString();
  });

  ytProcess.on('error', (err) => {
    // If yt-dlp executable is not found on path, return fallback info
    return res.status(500).json({
      success: false,
      message: `yt-dlp process execution failed: ${err.message}. Ensure yt-dlp is installed and available on PATH.`
    });
  });

  ytProcess.on('close', (code) => {
    if (code !== 0 && !stdoutData.trim()) {
      return res.status(500).json({
        success: false,
        message: stderrData.trim() || `yt-dlp exited with error code ${code}`
      });
    }

    try {
      const playlistData = JSON.parse(stdoutData.trim());
      const rawEntries = Array.isArray(playlistData.entries) ? playlistData.entries : [];
      const totalKnown = playlistData.playlist_count || rawEntries.length || 0;

      const videos = rawEntries.map((entry, idx) => {
        const globalIndex = startIndex + idx;
        const durSec = entry.duration || 0;
        const vidId = entry.id || entry.url || `track_${globalIndex}`;

        return {
          videoId: vidId,
          originalIndex: globalIndex,
          index: globalIndex,
          title: entry.title || `Track #${globalIndex}`,
          author: entry.uploader || entry.channel || playlistData.uploader || 'YouTube Creator',
          authorUrl: entry.uploader_url || '',
          durationSeconds: durSec,
          formattedDuration: formatDuration(durSec),
          thumbnailUrl: entry.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
          url: entry.url ? (entry.url.startsWith('http') ? entry.url : `https://www.youtube.com/watch?v=${entry.url}`) : `https://www.youtube.com/watch?v=${vidId}`,
          isAvailable: entry.title !== '[Private video]' && entry.title !== '[Deleted video]',
          availableQualities: ['1080p', '720p', '480p', '360p', 'MP3'],
          availableFormats: ['MP4', 'WebM', 'MP3', 'M4A']
        };
      });

      const hasMore = endIndex !== null ? (startIndex + videos.length <= totalKnown) : false;

      return res.json({
        success: true,
        id: playlistData.id || '',
        title: playlistData.title || 'YouTube Playlist',
        author: playlistData.uploader || playlistData.channel || 'YouTube Creator',
        thumbnailUrl: playlistData.thumbnails?.[0]?.url || (videos[0]?.thumbnailUrl || ''),
        startIndex: startIndex,
        videoCount: videos.length,
        totalKnownVideos: totalKnown > 0 ? totalKnown : (startIndex + videos.length),
        hasMore: hasMore,
        isMix: url.includes('list=RD') || url.includes('start_radio=1'),
        videos: videos
      });
    } catch (parseErr) {
      return res.status(500).json({
        success: false,
        message: `Failed to parse playlist manifest: ${parseErr.message}`,
        rawError: stderrData.slice(0, 300)
      });
    }
  });
}

module.exports = {
  fetchPlaylistQueue
};
