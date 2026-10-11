const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractSearchTerms,
  flattenSearchResults,
  resultSummary,
  _test,
} = require('../services/unifiedSearch');

test('extracts useful terms from a natural-language search request', () => {
  assert.deepEqual(
    extractSearchTerms('Can you find my notes about the nginx backup?'),
    ['nginx', 'backup'],
  );
  assert.deepEqual(extractSearchTerms('Where is the PHP 6,569 cash record?'), ['php', '6569', 'cash']);
});

test('ranks title matches ahead of detail-only matches', () => {
  const ranked = _test.sortAndLimit([
    { id: '1', type: 'task', title: 'Server work', detail: 'Review nginx backup', date: '2026-10-12' },
    { id: '2', type: 'task', title: 'Nginx backup', detail: 'Server work', date: '2026-10-11' },
  ], ['nginx', 'backup'], 5);

  assert.equal(ranked[0].id, '2');
  assert.equal(ranked[0].page, 'tasks');
});

test('summarizes and flattens results without private modules', () => {
  const results = {
    entries: [{ id: '1', type: 'life_log', page: 'life-log', title: 'Fix', date: '2026-10-10' }],
    knowledge: [],
    tasks: [{ id: '2', type: 'task', page: 'tasks', title: 'Backup', date: '2026-10-12' }],
    projects: [], transactions: [], forecasts: [], schedule: [], reminders: [],
  };

  assert.equal(resultSummary(results).total, 2);
  assert.deepEqual(flattenSearchResults(results).map((item) => item.id), ['2', '1']);
  assert.equal(flattenSearchResults(results).some((item) => ['diary', 'files', 'security'].includes(item.page)), false);
});
