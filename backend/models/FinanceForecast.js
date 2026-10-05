const mongoose = require('mongoose');

const ForecastItemSchema = new mongoose.Schema({
  date_start: { type: Date, required: true },
  date_end: { type: Date },
  label: { type: String, required: true, trim: true },
  kind: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, trim: true },
  status: {
    type: String,
    enum: ['planned', 'completed', 'skipped'],
    default: 'planned',
  },
  resolved_at: { type: Date },
  resolved_by: { type: String, enum: ['manual', 'transaction'] },
  matched_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  is_group: { type: Boolean, default: false },
  notes: { type: String, trim: true },
}, { _id: true });

const FinancingItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  provider: { type: String, trim: true },
  remaining_balance: { type: Number, min: 0, default: null },
  installments_remaining: { type: Number, min: 0, default: null },
  estimated_monthly: { type: Number, min: 0, default: null },
  due_day: { type: Number, min: 1, max: 31, default: null },
  notes: { type: String, trim: true },
}, { _id: true });

const FinanceForecastSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  account_name: { type: String, required: true, trim: true },
  currency: { type: String, default: 'PHP', trim: true },
  as_of_date: { type: Date, required: true, index: true },
  starting_balance: { type: Number, required: true },
  items: { type: [ForecastItemSchema], default: [] },
  financing: { type: [FinancingItemSchema], default: [] },
  archived_at: { type: Date },
}, { timestamps: true });

FinanceForecastSchema.index({ user_id: 1, as_of_date: -1 });

module.exports = mongoose.model('FinanceForecast', FinanceForecastSchema);
