const mongoose = require('mongoose');

const SecurityEventSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, lowercase: true, trim: true, index: true },
  type: {
    type: String,
    enum: ['login_success', 'login_failure', 'email_challenge_sent', 'email_challenge_failed', 'trusted_browser_revoked'],
    required: true,
    index: true,
  },
  outcome: { type: String, enum: ['success', 'failure', 'pending'], required: true, index: true },
  ip: { type: String, default: 'unknown', index: true },
  user_agent: { type: String, default: 'Unknown browser' },
  host: { type: String, default: '' },
  detail: { type: String, default: '' },
  expires_at: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('SecurityEvent', SecurityEventSchema);
