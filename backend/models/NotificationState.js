const mongoose = require('mongoose');

const NotificationStateSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fingerprint: { type: String, required: true, trim: true },
  read_at: { type: Date },
  dismissed_at: { type: Date },
}, { timestamps: true });

NotificationStateSchema.index({ user_id: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model('NotificationState', NotificationStateSchema);
