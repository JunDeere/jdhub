const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  period_type: { type: String, enum: ['daily', 'weekly'], required: true, index: true },
  period_start: { type: Date, required: true, index: true },
  period_end: { type: Date, required: true },
  wins: { type: String, trim: true, default: '' },
  reflection: { type: String, trim: true, default: '' },
  next_focus: { type: String, trim: true, default: '' },
  energy: { type: String, enum: ['', 'low', 'steady', 'high'], default: '' },
}, { timestamps: true });

ReviewSchema.index({ user_id: 1, period_type: 1, period_start: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);
