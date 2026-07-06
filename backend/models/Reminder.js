const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  remind_at: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'snoozed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  related_task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  related_project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  tags: [{ type: String, trim: true }],
  completed_at: { type: Date },
}, { timestamps: true });

ReminderSchema.index({ user_id: 1, status: 1, remind_at: 1 });

module.exports = mongoose.model('Reminder', ReminderSchema);
