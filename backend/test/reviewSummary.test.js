const assert = require('node:assert/strict');
const test = require('node:test');
const { financingDueItems, summarizeTransactions, validateReviewRange } = require('../services/reviewSummary');

test('review finance summary separates cash movement and ranks expense categories', () => {
  const summary = summarizeTransactions([
    { type: 'income', amount: 20510.08, category: 'Salary' },
    { type: 'expense', amount: 1200.25, category: 'Food' },
    { type: 'expense', amount: 300, category: 'Transport' },
    { type: 'expense', amount: 50.25, category: 'Food' },
    { type: 'transfer', amount: 5000, category: 'Transfer' },
  ]);

  assert.deepEqual(summary, {
    income: 20510.08,
    expense: 1550.5,
    transfer: 5000,
    net: 18959.58,
    transaction_count: 5,
    expense_categories: [
      { category: 'Food', amount: 1250.5 },
      { category: 'Transport', amount: 300 },
    ],
  });
});

test('review ranges accept a day or week and reject oversized ranges', () => {
  const start = new Date('2026-10-12T00:00:00.000Z');
  assert.equal(validateReviewRange('daily', start, new Date('2026-10-13T00:00:00.000Z')), null);
  assert.equal(validateReviewRange('weekly', start, new Date('2026-10-19T00:00:00.000Z')), null);
  assert.match(validateReviewRange('daily', start, new Date('2026-10-14T00:00:00.000Z')), /one day/);
  assert.match(validateReviewRange('monthly', start, new Date('2026-10-13T00:00:00.000Z')), /daily or weekly/);
});

test('review surfaces financing installments due in the next local period', () => {
  const items = financingDueItems([
    { _id: 'loan-1', name: 'SPayLater', provider: 'Shopee', due_day: 15, estimated_monthly: 955 },
  ], new Date('2026-11-14T16:00:00.000Z'), new Date('2026-11-15T16:00:00.000Z'), 'Asia/Manila');

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'SPayLater');
  assert.equal(items[0].amount, 955);
  assert.equal(items[0].financing, true);
});

test('review does not surface a financing cycle that was already paid', () => {
  const items = financingDueItems([{
    _id: 'loan-1',
    name: 'SPayLater',
    provider: 'Shopee',
    due_day: 15,
    estimated_monthly: 955,
    next_due_date: new Date('2026-11-15T00:00:00.000Z'),
  }], new Date('2026-10-14T00:00:00.000Z'), new Date('2026-10-17T00:00:00.000Z'), 'Asia/Manila');

  assert.equal(items.length, 0);
});
