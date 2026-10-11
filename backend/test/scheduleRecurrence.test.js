const test = require('node:test');
const assert = require('node:assert/strict');
const {
  expandScheduleItem,
  nextScheduleOccurrence,
  occurrenceStart,
} = require('../utils/scheduleRecurrence');

function recurringItem(overrides = {}) {
  return {
    _id: 'series-1',
    title: 'Review',
    start_at: new Date('2026-01-31T01:00:00.000Z'),
    end_at: new Date('2026-01-31T02:00:00.000Z'),
    recurrence_frequency: 'monthly',
    ...overrides,
  };
}

test('monthly recurrence keeps the intended day and clamps shorter months', () => {
  const base = new Date('2026-01-31T01:00:00.000Z');
  assert.equal(occurrenceStart(base, 'monthly', 1).toISOString(), '2026-02-28T01:00:00.000Z');
  assert.equal(occurrenceStart(base, 'monthly', 2).toISOString(), '2026-03-31T01:00:00.000Z');
});

test('expands recurring schedule items only inside the requested calendar range', () => {
  const occurrences = expandScheduleItem(
    recurringItem(),
    new Date('2026-02-01T00:00:00.000Z'),
    new Date('2026-04-30T23:59:59.999Z'),
  );
  assert.deepEqual(
    occurrences.map((item) => item.start_at.toISOString()),
    ['2026-02-28T01:00:00.000Z', '2026-03-31T01:00:00.000Z', '2026-04-30T01:00:00.000Z'],
  );
  assert.equal(occurrences[0].end_at.toISOString(), '2026-02-28T02:00:00.000Z');
});

test('respects the optional recurrence end date and finds the next occurrence', () => {
  const item = recurringItem({ recurrence_until: new Date('2026-03-31T23:59:59.999Z') });
  const next = nextScheduleOccurrence(item, new Date('2026-03-01T00:00:00.000Z'));
  assert.equal(next.start_at.toISOString(), '2026-03-31T01:00:00.000Z');
  assert.equal(nextScheduleOccurrence(item, new Date('2026-04-01T00:00:00.000Z')), null);
});
