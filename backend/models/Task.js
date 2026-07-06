const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: {
    type: String,
    enum: ['backlog', 'todo', 'doing', 'blocked', 'done', 'cancelled'],
    default: 'todo',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true,
  },
  category: { type: String, default: 'Personal', trim: true },
  due_date: { type: Date, index: true },
  related_project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  tags: [{ type: String, trim: true }],
  completed_at: { type: Date },
  cancelled_at: { type: Date },
}, { timestamps: true });

TaskSchema.index({ user_id: 1, status: 1, priority: 1, due_date: 1 });
TaskSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Task', TaskSchema);
