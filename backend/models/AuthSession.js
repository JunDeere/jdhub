const mongoose = require('mongoose');

const AuthSessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jti: { type: String, required: true, unique: true, index: true },
  ip: { type: String, default: 'unknown' },
  user_agent: { type: String, default: 'Unknown browser' },
  last_seen_at: { type: Date, default: Date.now, index: true },
  expires_at: { type: Date, required: true, index: { expires: 0 } },
  revoked_at: { type: Date },
}, { timestamps: true });

AuthSessionSchema.index({ user_id: 1, revoked_at: 1, expires_at: 1 });

module.exports = mongoose.model('AuthSession', AuthSessionSchema);
