const mongoose = require('mongoose');

const DiaryVaultSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  version: { type: Number, required: true, default: 1 },
  algorithm: { type: String, required: true, default: 'PBKDF2-SHA256/AES-256-GCM' },
  kdf_salt: { type: String, required: true },
  kdf_iterations: { type: Number, required: true },
  wrapped_key: { type: String, required: true },
  wrapped_key_iv: { type: String, required: true },
  memory_prompts_enabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('DiaryVault', DiaryVaultSchema);
