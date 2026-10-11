const mongoose = require('mongoose');

const GoogleCalendarLinkSchema = new mongoose.Schema({
  connection_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  calendar_id: { type: String, default: 'primary', trim: true },
  event_id: { type: String, required: true, trim: true },
  event_url: { type: String, trim: true },
  event_updated_at: { type: Date },
}, { _id: false });

const ScheduleItemSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  start_at: { type: Date, required: true, index: true },
  end_at: { type: Date },
  all_day: { type: Boolean, default: false },
  location: { type: String, trim: true },
  status: {
    type: String,
    enum: ['scheduled', 'done', 'cancelled'],
    default: 'scheduled',
    index: true,
  },
  related_project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  related_task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  external_calendar_id: { type: String },
  external_provider: { type: String, enum: ['google'] },
  external_url: { type: String, trim: true },
  external_updated_at: { type: Date },
  external_account_email: { type: String, trim: true, lowercase: true },
  google_calendar_links: { type: [GoogleCalendarLinkSchema], default: [] },
  sync_source: { type: String, enum: ['local', 'google', 'jdhub'], default: 'local' },
  sync_last_at: { type: Date },
}, { timestamps: true });

ScheduleItemSchema.index({ user_id: 1, status: 1, start_at: 1 });
ScheduleItemSchema.index({ user_id: 1, external_provider: 1, external_calendar_id: 1 }, { sparse: true });
ScheduleItemSchema.index({ user_id: 1, 'google_calendar_links.connection_id': 1, 'google_calendar_links.event_id': 1 });

module.exports = mongoose.model('ScheduleItem', ScheduleItemSchema);
