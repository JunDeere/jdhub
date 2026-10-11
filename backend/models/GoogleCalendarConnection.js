const mongoose = require('mongoose');

const GoogleCalendarAccountSchema = new mongoose.Schema({
  account_subject: { type: String, trim: true },
  account_email: { type: String, required: true, trim: true, lowercase: true },
  calendar_id: { type: String, default: 'primary', trim: true },
  token_blob: { type: String, required: true, select: false },
  scopes: [{ type: String, trim: true }],
  connected_at: { type: Date, default: Date.now },
  last_synced_at: { type: Date },
  last_error: { type: String, trim: true },
}, { timestamps: true });

const GoogleCalendarConnectionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  accounts: { type: [GoogleCalendarAccountSchema], default: [] },
  // Legacy single-account fields are retained so existing installations can be
  // migrated into `accounts` the first time they are read.
  account_email: { type: String, trim: true },
  calendar_id: { type: String, default: 'primary', trim: true },
  token_blob: { type: String, select: false },
  scopes: [{ type: String, trim: true }],
  connected_at: { type: Date, default: Date.now },
  last_synced_at: { type: Date },
  last_error: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('GoogleCalendarConnection', GoogleCalendarConnectionSchema);
