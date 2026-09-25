const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');

// POST /api/feedback — Record uninstallation or general feedback
router.post('/', async (req, res) => {
  try {
    const { source, rating, reasons, comment, email } = req.body;
    const feedback = new Feedback({
      source: source || 'web',
      rating: Number(rating) || 0,
      reasons: Array.isArray(reasons) ? reasons : [],
      comment: comment ? String(comment).slice(0, 2000) : '',
      email: email ? String(email).slice(0, 200) : '',
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip || ''
    });

    await feedback.save();
    console.log(`[Feedback] 📥 New feedback received from [${feedback.source}], rating: ${feedback.rating}`);

    return res.status(201).json({
      success: true,
      message: 'Feedback received successfully. Thank you!'
    });
  } catch (err) {
    console.error('[Feedback] Save error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error saving feedback'
    });
  }
});

// GET /api/feedback — Admin view recent feedback list
router.get('/', async (req, res) => {
  try {
    const list = await Feedback.find().sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, count: list.length, feedbacks: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
