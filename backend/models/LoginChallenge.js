const mongoose = require('mongoose');

const LoginChallengeSchema = new mongoose.Schema({
  challenge_id: { type: String, required: true, unique: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  code_hash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expires_at: { type: Date, required: true, index: { expires: 0 } },
  used_at: { type: Date },
  request_ip: { type: String, default: 'unknown' },
  user_agent: { type: String, default: 'Unknown browser' },
}, { timestamps: true });

module.exports = mongoose.model('LoginChallenge', LoginChallengeSchema);
