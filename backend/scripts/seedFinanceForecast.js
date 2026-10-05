const mongoose = require('mongoose');
require('dotenv').config();
const FinanceForecast = require('../models/FinanceForecast');

const userId = process.env.FORECAST_USER_ID;
if (!userId || !mongoose.isValidObjectId(userId)) {
  throw new Error('Set FORECAST_USER_ID to the JDHub account that owns this private forecast.');
}

const date = (value) => new Date(`${value}T00:00:00.000Z`);

const items = [
  { date_start: date('2026-09-24'), label: 'GLoan CXVM', kind: 'expense', amount: 3473.17, category: 'Financing' },
  { date_start: date('2026-09-24'), label: 'SLoan', kind: 'expense', amount: 2852.27, category: 'Financing' },
  { date_start: date('2026-09-24'), label: 'PLDT', kind: 'expense', amount: 2500, category: 'Utilities' },
  { date_start: date('2026-09-25'), label: 'Salary', kind: 'income', amount: 16000, category: 'Income' },
  { date_start: date('2026-09-25'), label: 'Gym', kind: 'expense', amount: 3500, category: 'Health' },
  { date_start: date('2026-09-28'), label: 'GLoan EHAF', kind: 'expense', amount: 3969.33, category: 'Financing', notes: 'Statement due amount; later installments may vary slightly.' },
  { date_start: date('2026-10-03'), label: 'ChatGPT', kind: 'expense', amount: 1100, category: 'Subscription' },
  { date_start: date('2026-10-09'), label: 'Salary', kind: 'income', amount: 16000, category: 'Income' },
  { date_start: date('2026-10-15'), label: 'GLoan LYGE', kind: 'expense', amount: 1950.17, category: 'Financing' },
  { date_start: date('2026-10-15'), label: 'GGives GPU', kind: 'expense', amount: 3774.26, category: 'Financing' },
  { date_start: date('2026-10-15'), label: 'Existing SPayLater', kind: 'expense', amount: 4836.95, category: 'Financing' },
  { date_start: date('2026-10-16'), label: 'GLoan KDB', kind: 'expense', amount: 3473.17, category: 'Financing' },
  { date_start: date('2026-10-23'), label: 'Salary', kind: 'income', amount: 16000, category: 'Income' },
  { date_start: date('2026-10-24'), label: 'GLoan CXVM', kind: 'expense', amount: 3473.17, category: 'Financing' },
  { date_start: date('2026-10-24'), label: 'SLoan', kind: 'expense', amount: 2852.27, category: 'Financing' },
  { date_start: date('2026-10-24'), label: 'PLDT', kind: 'expense', amount: 2500, category: 'Utilities' },
  { date_start: date('2026-10-25'), label: 'Gym', kind: 'expense', amount: 3500, category: 'Health' },
  { date_start: date('2026-10-28'), label: 'GLoan EHAF', kind: 'expense', amount: 3969.33, category: 'Financing' },
  { date_start: date('2026-11-03'), label: 'ChatGPT', kind: 'expense', amount: 1100, category: 'Subscription' },
  { date_start: date('2026-11-06'), label: 'Salary', kind: 'income', amount: 16000, category: 'Income' },
  { date_start: date('2026-11-15'), date_end: date('2026-11-16'), label: 'Loans + SPayLater', kind: 'expense', amount: 9701.93, category: 'Financing', is_group: true, notes: 'Combined payment supplied for Nov 15–16.' },
  { date_start: date('2026-11-20'), label: 'Salary', kind: 'income', amount: 16000, category: 'Income' },
  { date_start: date('2026-11-24'), date_end: date('2026-11-28'), label: 'Loans + PLDT + gym', kind: 'expense', amount: 16294.77, category: 'Combined', is_group: true },
  { date_start: date('2026-12-03'), label: 'ChatGPT', kind: 'expense', amount: 1100, category: 'Subscription' },
  { date_start: date('2026-12-04'), label: 'Salary', kind: 'income', amount: 16000, category: 'Income' },
  { date_start: date('2026-12-15'), date_end: date('2026-12-16'), label: 'Loans', kind: 'expense', amount: 9197.60, category: 'Financing', is_group: true, notes: 'Combined loan payment.' },
  { date_start: date('2026-12-18'), label: 'Salary', kind: 'income', amount: 16000, category: 'Income' },
  { date_start: date('2026-12-24'), date_end: date('2026-12-28'), label: 'Loans + PLDT + gym', kind: 'expense', amount: 16294.77, category: 'Combined', is_group: true },
];

const financing = [
  { name: 'GGives GPU', provider: 'Fuse Financing', remaining_balance: 26419.78, installments_remaining: 7, estimated_monthly: 3774.25, due_day: 15, notes: 'Monthly estimate may differ by a cent because of installment rounding.' },
  { name: 'GLoan LYGE', provider: 'Fuse Financing', remaining_balance: 7800.63, installments_remaining: 4, estimated_monthly: 1950.16, due_day: 15 },
  { name: 'GLoan KDB', provider: 'Fuse Financing', remaining_balance: 24312.17, installments_remaining: 7, estimated_monthly: 3473.17, due_day: 16 },
  { name: 'GLoan CXVM', provider: 'Fuse Financing', remaining_balance: 27785.34, installments_remaining: 8, estimated_monthly: 3473.17, due_day: 24 },
  { name: 'GLoan EHAF', provider: 'UNOBank', remaining_balance: 19856.25, installments_remaining: 5, estimated_monthly: 3971.25, due_day: 28, notes: 'The September statement due amount is ₱3,969.33; future installments may adjust.' },
  { name: 'SLoan', provider: 'Shopee', estimated_monthly: 2852.27, due_day: 24, notes: 'Remaining balance and installment count were not supplied.' },
  { name: 'SPayLater', provider: 'Shopee', estimated_monthly: 4836.95, due_day: 15, notes: 'October amount is known; later payment amounts vary.' },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/jdhub');
  const forecast = await FinanceForecast.findOneAndUpdate(
    { user_id: new mongoose.Types.ObjectId(userId), name: 'GCash Sep–Dec 2026' },
    {
      $set: {
        account_name: 'GCash', currency: 'PHP', as_of_date: date('2026-09-24'),
        starting_balance: 14128.33, items, financing,
      },
      $unset: { archived_at: '' },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  console.log(`Finance forecast ready: ${forecast._id}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
