const assert = require('node:assert/strict');
const test = require('node:test');
const { applyItemAdjustment } = require('../services/financingPayments');
const { transactionPayload } = require('../routes/transactions');

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

test('a financing transaction can include fees without applying them to the loan balance', () => {
  const payload = transactionPayload({
    type: 'expense',
    amount: 215,
    financing_item_id: '507f1f77bcf86cd799439011',
    financing_payment_amount: 200,
    financing_installments_paid: 2,
  });
  assert.equal(payload.amount, 215);
  assert.equal(payload.financing_payment_amount, 200);
  assert.equal(payload.financing_installments_paid, 2);
});

test('advance installments reduce the remaining payment count together', () => {
  const item = { name: 'Example plan', remaining_balance: 1200, installments_remaining: 6 };
  applyItemAdjustment(item, 400, 2);
  assert.equal(item.remaining_balance, 800);
  assert.equal(item.installments_remaining, 4);
});

test('advance installments cannot exceed the payments remaining', () => {
  const item = { name: 'Example plan', remaining_balance: 1200, installments_remaining: 1 };
  assert.throws(() => applyItemAdjustment(item, 400, 2), /exceed the payments remaining/);
});

test('amount applied to financing cannot exceed total cash paid', () => {
  assert.throws(() => transactionPayload({
    type: 'expense',
    amount: 200,
    financing_item_id: '507f1f77bcf86cd799439011',
    financing_payment_amount: 215,
  }), /cannot exceed the total transaction amount/);
});
