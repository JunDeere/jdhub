const assert = require('node:assert/strict');
const test = require('node:test');
const {
  applyItemAdjustment,
  financingCycleStatus,
} = require('../services/financingPayments');
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
  const item = {
    name: 'Example plan', remaining_balance: 1200, installments_remaining: 6, due_day: 15,
  };
  applyItemAdjustment(item, 400, 2, new Date('2026-10-12T00:00:00.000Z'));
  assert.equal(item.remaining_balance, 800);
  assert.equal(item.installments_remaining, 4);
  assert.equal(item.next_due_date.toISOString(), '2026-12-15T00:00:00.000Z');
  assert.equal(financingCycleStatus(item, new Date('2026-10-12T00:00:00.000Z')).cycle_status, 'paid');
});

test('a current-cycle payment advances the next due date and marks this month paid', () => {
  const item = {
    name: 'Example plan', remaining_balance: 600, installments_remaining: 3, due_day: 15,
  };
  applyItemAdjustment(item, 200, 1, new Date('2026-10-12T00:00:00.000Z'));
  const status = financingCycleStatus(item, new Date('2026-10-12T00:00:00.000Z'));
  assert.equal(item.next_due_date.toISOString(), '2026-11-15T00:00:00.000Z');
  assert.equal(status.cycle_status, 'paid');
  assert.equal(status.paid_through_date.toISOString(), '2026-10-15T00:00:00.000Z');
});

test('deleting a payment restores the closed billing cycle', () => {
  const item = {
    name: 'Example plan', remaining_balance: 400, installments_remaining: 2,
    due_day: 15, next_due_date: new Date('2026-11-15T00:00:00.000Z'),
  };
  applyItemAdjustment(item, -200, -1, new Date('2026-10-12T00:00:00.000Z'));
  assert.equal(item.remaining_balance, 600);
  assert.equal(item.installments_remaining, 3);
  assert.equal(item.next_due_date.toISOString(), '2026-10-15T00:00:00.000Z');
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
