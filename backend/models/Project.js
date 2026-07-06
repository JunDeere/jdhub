const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: {
    type: String,
    enum: ['backlog', 'active', 'paused', 'blocked', 'done', 'archived'],
    default: 'active',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    index: true,
  },
  notes: { type: String, trim: true },
  tags: [{ type: String, trim: true }],
  start_date: { type: Date },
  target_date: { type: Date },
  archived_at: { type: Date },
}, { timestamps: true });

ProjectSchema.index({ user_id: 1, status: 1, updatedAt: -1 });
ProjectSchema.index({ name: 'text', description: 'text', notes: 'text', tags: 'text' });

module.exports = mongoose.model('Project', ProjectSchema);
