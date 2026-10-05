const mongoose = require('mongoose');

const FileShareSchema = new mongoose.Schema({
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  resource_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FileItem', required: true, index: true },
  token_hash: { type: String, required: true, unique: true, index: true },
  expires_at: { type: Date, required: true, index: true },
}, { timestamps: true });

FileShareSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
FileShareSchema.index({ owner_id: 1, resource_id: 1 });

module.exports = mongoose.model('FileShare', FileShareSchema);
