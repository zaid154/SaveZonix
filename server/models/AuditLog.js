const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  adminEmail: {
    type: String,
    default: 'System',
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: ['User', 'Plan', 'Settings', 'Coupon', 'Payment', 'System'],
    default: 'System'
  },
  targetId: {
    type: String,
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
