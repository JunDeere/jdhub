const mongoose = require('mongoose');

const EntrySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, default: 'life_log', index: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
  category: { type: String, default: 'Personal', trim: true, index: true },
  tags: [{ type: String, trim: true }],
  related_project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  related_task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  archived_at: { type: Date },
}, { timestamps: true });

EntrySchema.index({ title: 'text', content: 'text', tags: 'text' });
EntrySchema.index({ user_id: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Entry', EntrySchema);
