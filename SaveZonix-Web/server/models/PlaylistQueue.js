const mongoose = require('mongoose');

const PlaylistItemSchema = new mongoose.Schema({
  index: { type: Number, default: 1 },
  videoId: { type: String, required: true },
  title: { type: String, default: '' },
  author: { type: String, default: 'YouTube' },
  duration: { type: String, default: '00:00' },
  durationSeconds: { type: Number, default: 0 },
  thumbnailUrl: { type: String, default: '' },
  isAvailable: { type: Boolean, default: true },
  availableQualities: { type: [String], default: ['4K', '2K', '1080p', '720p', 'MP3'] },
  availableFormats: { type: [String], default: ['MP4', 'WebM', 'MP3', 'M4A'] }
}, { _id: false });

const PlaylistQueueSchema = new mongoose.Schema({
  queueKey: { type: String, required: true, unique: true, index: true },
  url: { type: String, required: true },
  title: { type: String, default: 'YouTube Playlist' },
  author: { type: String, default: 'YouTube' },
  thumbnailUrl: { type: String, default: '' },
  totalKnownVideos: { type: Number, default: 0 },
  isMix: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  items: [PlaylistItemSchema],
  createdAt: { type: Date, default: Date.now, expires: 86400 * 7 } // Auto-clean after 7 days
});

module.exports = mongoose.model('PlaylistQueue', PlaylistQueueSchema);
