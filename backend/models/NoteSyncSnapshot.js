const mongoose = require('mongoose');

const RawFileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  modified_at: { type: Date, required: true },
  data: { type: Buffer, required: true },
}, { _id: false });

const NoteSyncSnapshotSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  state_hash: { type: String, required: true },
  captured_at: { type: Date, required: true },
  notepad_version: { type: String, default: 'unknown' },
  note_count: { type: Number, default: 0 },
  files: { type: [RawFileSchema], default: [] },
}, { timestamps: true });

NoteSyncSnapshotSchema.index({ user_id: 1, state_hash: 1 }, { unique: true });
NoteSyncSnapshotSchema.index({ user_id: 1, captured_at: -1 });

module.exports = mongoose.model('NoteSyncSnapshot', NoteSyncSnapshotSchema);
