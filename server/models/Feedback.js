const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  source: { type: String, default: 'web' }, // 'extension', 'desktop', 'web'
  rating: { type: Number, default: 0 },
  reasons: [{ type: String }],
  comment: { type: String, default: '' },
  email: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', FeedbackSchema);
