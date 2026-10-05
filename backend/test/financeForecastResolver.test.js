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
  assert.equal(forecast.summary.ending_balance, 1350);
});
