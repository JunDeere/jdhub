const mongoose = require('mongoose');

const DiaryEntrySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  version: { type: Number, required: true, default: 1 },
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
}, { timestamps: true });

DiaryEntrySchema.index({ user_id: 1, updatedAt: -1 });

module.exports = mongoose.model('DiaryEntry', DiaryEntrySchema);
