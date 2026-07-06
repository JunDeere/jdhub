const mongoose = require('mongoose');

const CommandActionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  command_message_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CommandMessage', required: true, index: true },
  action_type: {
    type: String,
    enum: ['create_life_log', 'create_task', 'create_transaction'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['previewed', 'completed', 'cancelled', 'failed'],
    default: 'previewed',
    index: true,
  },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  result_model: { type: String, trim: true },
  result_id: { type: mongoose.Schema.Types.ObjectId },
  error: { type: String, trim: true },
}, { timestamps: true });

CommandActionSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('CommandAction', CommandActionSchema);
