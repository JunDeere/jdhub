const mongoose = require('mongoose');

const ServerRecordSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  record_type: {
    type: String,
    enum: ['server_note', 'incident_log', 'container_record', 'port_record'],
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['active', 'planned', 'watching', 'resolved', 'inactive'],
    default: 'active',
    index: true,
  },
  host: { type: String, trim: true },
  port: { type: Number },
  service: { type: String, trim: true },
  environment: { type: String, trim: true },
  notes: { type: String, trim: true },
  occurred_at: { type: Date },
  tags: [{ type: String, trim: true }],
  archived_at: { type: Date },
}, { timestamps: true });

ServerRecordSchema.index({ user_id: 1, record_type: 1, updatedAt: -1 });
ServerRecordSchema.index({ name: 'text', host: 'text', service: 'text', notes: 'text', tags: 'text' });

module.exports = mongoose.model('ServerRecord', ServerRecordSchema);
