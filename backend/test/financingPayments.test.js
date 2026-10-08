const assert = require('node:assert/strict');
const test = require('node:test');
const { applyItemAdjustment } = require('../services/financingPayments');

test('financing payment reduces the known balance and installment count', () => {
  const item = { name: 'Example plan', remaining_balance: 1200, installments_remaining: 6 };
  applyItemAdjustment(item, 200, 1);
  assert.equal(item.remaining_balance, 1000);
  assert.equal(item.installments_remaining, 5);
});

test('editing a linked payment applies only the payment difference', () => {
  const item = { name: 'Example plan', remaining_balance: 1000, installments_remaining: 5 };
  applyItemAdjustment(item, 50, 0);
  assert.equal(item.remaining_balance, 950);
  assert.equal(item.installments_remaining, 5);
});

test('financing payment cannot exceed a known remaining balance', () => {
  const item = { name: 'Example plan', remaining_balance: 100, installments_remaining: 1 };
  assert.throws(() => applyItemAdjustment(item, 125, 1), /exceeds the remaining balance/);
});
