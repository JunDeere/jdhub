const assert = require('node:assert/strict');
const test = require('node:test');
const { summarizeCashTransactions } = require('../services/financeCashLedger');

test('cash position applies actual income and expenses after the saved baseline', () => {
  const cash = summarizeCashTransactions({
    starting_balance: 6569,
    currency: 'PHP',
    cash_anchor_at: new Date('2026-10-12T00:00:00.000Z'),
  }, [
    { type: 'income', amount: 20510.08, currency: 'PHP' },
    { type: 'expense', amount: 6500, currency: 'PHP' },
    { type: 'transfer', amount: 1000, currency: 'PHP' },
    { type: 'expense', amount: 50, currency: 'USD' },
  ]);

  assert.equal(cash.baseline_balance, 6569);
  assert.equal(cash.income, 20510.08);
  assert.equal(cash.expense, 6500);
  assert.equal(cash.net_change, 14010.08);
  assert.equal(cash.current_balance, 20579.08);
  assert.equal(cash.transaction_count, 2);
});
