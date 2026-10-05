const mongoose = require('mongoose');

const TrustedBrowserSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token_hash: { type: String, required: true, unique: true, index: true },
  label: { type: String, default: 'Trusted browser' },
  user_agent: { type: String, default: 'Unknown browser' },
  first_ip: { type: String, default: 'unknown' },
  last_ip: { type: String, default: 'unknown' },
  last_seen_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true, index: { expires: 0 } },
  revoked_at: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('TrustedBrowser', TrustedBrowserSchema);
