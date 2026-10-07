const mongoose = require('mongoose');

const TaskCheckInSchema = new mongoose.Schema({
  task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  title: { type: String, required: true, trim: true },
  due_date: { type: Date, required: true },
  state: { type: String, enum: ['pending', 'deferred', 'previewed'], default: 'pending' },
}, { _id: false });

const AssistantMessageSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  module_id: { type: String, required: true, default: 'command-center', trim: true, index: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, trim: true, maxlength: 6000 },
  message_type: {
    type: String,
    enum: ['chat', 'action_preview', 'action_result'],
    default: 'chat',
    index: true,
  },
  model: { type: String, trim: true },
  command_message_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CommandMessage' },
  task_check_in: { type: TaskCheckInSchema, default: undefined },
}, { timestamps: true });

AssistantMessageSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('AssistantMessage', AssistantMessageSchema);
