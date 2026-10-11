const mongoose = require('mongoose');

const GoogleCalendarConnectionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  account_email: { type: String, trim: true },
  calendar_id: { type: String, default: 'primary', trim: true },
  token_blob: { type: String, required: true, select: false },
  scopes: [{ type: String, trim: true }],
  connected_at: { type: Date, default: Date.now },
  last_synced_at: { type: Date },
  last_error: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('GoogleCalendarConnection', GoogleCalendarConnectionSchema);
