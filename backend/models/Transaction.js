const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['income', 'expense', 'transfer'],
    required: true,
    index: true,
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'PHP', trim: true },
  category: { type: String, required: true, trim: true, index: true },
  date: { type: Date, required: true, index: true },
  merchant_or_source: { type: String, trim: true },
  payment_method: { type: String, trim: true },
  note: { type: String, trim: true },
  receipt_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt' },
  is_recurring: { type: Boolean, default: false },
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

TransactionSchema.index({ user_id: 1, date: -1, category: 1, type: 1 });
TransactionSchema.index({ merchant_or_source: 'text', note: 'text', tags: 'text' });

module.exports = mongoose.model('Transaction', TransactionSchema);
