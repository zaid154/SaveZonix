const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');

/**
 * GET /api/plans
 * Returns all active plans for public pricing & modals
 */
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1, priceINR: 1 });
    return res.json({
      success: true,
      count: plans.length,
      plans
    });
  } catch (err) {
    console.error('[PlansRoute] Error fetching plans:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve plans' });
  }
});

/**
 * GET /api/plans/:identifier (slug or ID)
 */
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let plan = null;

    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      plan = await Plan.findById(identifier);
    }
    if (!plan) {
      plan = await Plan.findOne({ slug: identifier.toLowerCase() });
    }

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    return res.json({ success: true, plan });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
