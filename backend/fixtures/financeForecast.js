// Entirely synthetic: these dates, labels, amounts, and providers do not describe
// a real person or account. Keep personal financial data in the private database.
const date = (value) => new Date(`${value}T00:00:00.000Z`);

module.exports = {
  name: 'Synthetic example forecast v1',
  account_name: 'Example Wallet (fictional)',
  currency: 'PHP',
  as_of_date: date('2030-01-01'),
  starting_balance: 1000,
  items: [
    { date_start: date('2030-01-02'), label: 'Example income A', kind: 'income', amount: 2000, category: 'Income' },
    { date_start: date('2030-01-05'), label: 'Example utility', kind: 'expense', amount: 100, category: 'Utilities' },
    { date_start: date('2030-01-10'), label: 'Example installment A', kind: 'expense', amount: 200, category: 'Financing' },
    { date_start: date('2030-01-15'), label: 'Example income B', kind: 'income', amount: 2000, category: 'Income' },
    { date_start: date('2030-01-20'), date_end: date('2030-01-22'), label: 'Example grouped bills', kind: 'expense', amount: 300, category: 'Combined', is_group: true, notes: 'Fictional date-range example.' },
    { date_start: date('2030-02-02'), label: 'Example income C', kind: 'income', amount: 2000, category: 'Income' },
    { date_start: date('2030-02-05'), label: 'Example subscription', kind: 'expense', amount: 50, category: 'Subscription' },
    { date_start: date('2030-02-10'), label: 'Example installment A', kind: 'expense', amount: 200, category: 'Financing' },
  ],
  financing: [
    { name: 'Example installment A', provider: 'Fictional Provider A', remaining_balance: 1200, installments_remaining: 6, estimated_monthly: 200, due_day: 10, notes: 'Synthetic financing example only.' },
    { name: 'Example installment B', provider: 'Fictional Provider B', estimated_monthly: 100, due_day: 20, notes: 'Synthetic example with an unspecified balance and installment count.' },
  ],
};
