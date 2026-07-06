const mongoose = require('mongoose');

const IntegrationRecordSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, required: true, trim: true },
  purpose: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['planned', 'researching', 'ready', 'active', 'paused', 'blocked'],
    default: 'planned',
    index: true,
  },
  auth_type: { type: String, trim: true },
  owner: { type: String, trim: true },
  notes: { type: String, trim: true },
  tags: [{ type: String, trim: true }],
  archived_at: { type: Date },
}, { timestamps: true });

IntegrationRecordSchema.index({ user_id: 1, status: 1, updatedAt: -1 });
IntegrationRecordSchema.index({ provider: 'text', purpose: 'text', notes: 'text', tags: 'text' });

module.exports = mongoose.model('IntegrationRecord', IntegrationRecordSchema);
