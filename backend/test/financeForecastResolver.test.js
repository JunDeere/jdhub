const assert = require('node:assert/strict');
const test = require('node:test');
const { resolutionStatus, serializeForecast } = require('../services/financeForecastResolver');

const now = new Date('2026-09-28T08:00:00.000Z');

test('forecast resolution distinguishes overdue, due today, upcoming, and completed items', () => {
  assert.equal(resolutionStatus({ status: 'planned', date_start: '2026-09-27T00:00:00.000Z' }, now), 'overdue');
  assert.equal(resolutionStatus({ status: 'planned', date_start: '2026-09-28T00:00:00.000Z' }, now), 'due_today');
  assert.equal(resolutionStatus({ status: 'planned', date_start: '2026-09-29T00:00:00.000Z' }, now), 'upcoming');
  assert.equal(resolutionStatus({ status: 'completed', date_start: '2026-09-20T00:00:00.000Z' }, now), 'completed');
});

test('serialized forecasts expose resolver counts without assuming overdue items were paid', () => {
  const forecast = serializeForecast({
    starting_balance: 1000,
    items: [
      { status: 'planned', kind: 'expense', amount: 100, date_start: '2026-09-27T00:00:00.000Z' },
      { status: 'completed', kind: 'income', amount: 500, date_start: '2026-09-28T00:00:00.000Z' },
      { status: 'planned', kind: 'expense', amount: 50, date_start: '2026-09-29T00:00:00.000Z' },
    ],
  }, now);

  assert.equal(forecast.resolution.overdue, 1);
  assert.equal(forecast.resolution.completed, 1);
  assert.equal(forecast.resolution.upcoming, 1);
  assert.equal(forecast.items[0].status, 'planned');
  assert.equal(forecast.items[0].resolution_status, 'overdue');
  assert.equal(forecast.summary.total_income, 0);
  assert.equal(forecast.summary.total_expense, 150);
  assert.equal(forecast.summary.ending_balance, 850);
});

test('serialized forecasts project unresolved plans from ledger-derived current cash', () => {
  const forecast = serializeForecast({
    starting_balance: 1000,
    items: [
      { status: 'completed', kind: 'income', amount: 500, date_start: '2026-09-28T00:00:00.000Z' },
      { status: 'planned', kind: 'expense', amount: 100, date_start: '2026-09-29T00:00:00.000Z' },
    ],
  }, now, {
    baseline_balance: 1000,
    current_balance: 1400,
    income: 500,
    expense: 100,
    net_change: 400,
    transaction_count: 2,
  });

  assert.equal(forecast.cash.current_balance, 1400);
  assert.equal(forecast.items[0].projected_balance, 1400);
  assert.equal(forecast.items[1].projected_balance, 1300);
  assert.equal(forecast.summary.ending_balance, 1300);
});
