const mongoose = require('mongoose');

const CommandMessageSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  raw_text: { type: String, required: true, trim: true },
  module_id: { type: String, required: true, default: 'command-center', trim: true, index: true },
  command_type: {
    type: String,
    enum: ['add_note', 'create_task', 'update_task', 'log_expense', 'unknown'],
    default: 'unknown',
    index: true,
  },
  status: {
    type: String,
    enum: ['previewed', 'saved', 'cancelled', 'failed'],
    default: 'previewed',
    index: true,
  },
  preview: { type: mongoose.Schema.Types.Mixed, default: {} },
  saved_record_id: { type: mongoose.Schema.Types.ObjectId },
  saved_record_type: { type: String, trim: true },
  error: { type: String, trim: true },
}, { timestamps: true });

CommandMessageSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('CommandMessage', CommandMessageSchema);
