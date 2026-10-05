const mongoose = require('mongoose');

const FileItemSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['file', 'folder'], required: true, index: true },
  name: { type: String, required: true, trim: true },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FileItem', default: null, index: true },
  stored_name: { type: String, trim: true },
  storage_path: { type: String, trim: true },
  mime_type: { type: String, trim: true },
  size: { type: Number, min: 0, default: 0 },
  sha256: { type: String, trim: true },
  security_status: { type: String, enum: ['checked', 'review'], default: 'checked', index: true },
  security_findings: [{ type: String, trim: true }],
  description: { type: String, trim: true },
  related_project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
}, { timestamps: true });

FileItemSchema.index({ user_id: 1, parent_id: 1, kind: 1, name: 1 });
FileItemSchema.index({ user_id: 1, name: 'text', description: 'text' });

module.exports = mongoose.model('FileItem', FileItemSchema);
