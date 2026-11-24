/**
 * Extract the 11-character YouTube video ID from watch, youtu.be, shorts, live, or embed URLs.
 */
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return '';
  const match = url.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i
  );
  return match && match[1] ? match[1] : '';
}

/**
 * Derive a reliable YouTube thumbnail URL from a video URL.
 */
export function getYouTubeThumbnail(url, fallback = '') {
  const id = extractYouTubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : fallback;
}

/**
 * Resolve the primary thumbnail URL for a media/download record,
 * falling back to YouTube thumbnail extraction when `thumbnailUrl` is blank.
 */
export function resolveMediaThumbnail(record) {
  if (!record) return '';
  if (typeof record.thumbnailUrl === 'string' && record.thumbnailUrl.trim()) {
    return record.thumbnailUrl.trim();
  }
  return getYouTubeThumbnail(record.originalUrl || record.url || '');
}
