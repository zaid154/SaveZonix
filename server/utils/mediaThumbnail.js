/**
 * Derive a YouTube thumbnail URL when an explicit thumbnail is missing.
 */
function resolveMediaThumbnail(thumbnailUrl, originalUrl) {
  if (typeof thumbnailUrl === 'string' && thumbnailUrl.trim()) {
    return thumbnailUrl.trim();
  }
  if (!originalUrl || typeof originalUrl !== 'string') {
    return '';
  }
  const match = originalUrl.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i
  );
  return match && match[1] ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : '';
}

module.exports = { resolveMediaThumbnail };
