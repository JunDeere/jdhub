const mongoose = require('mongoose');

const ScheduleItemSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  start_at: { type: Date, required: true, index: true },
  end_at: { type: Date },
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
}, { timestamps: true });

ScheduleItemSchema.index({ user_id: 1, status: 1, start_at: 1 });

module.exports = mongoose.model('ScheduleItem', ScheduleItemSchema);
