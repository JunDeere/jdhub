const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DEFAULT_PREFERENCES, preferencesFor } = require('../services/notifications');

test('notification preferences default every supported signal to enabled', () => {
  assert.deepEqual(preferencesFor(null), DEFAULT_PREFERENCES);
});

test('saved notification preferences override defaults without losing new categories', () => {
  assert.deepEqual(preferencesFor({ notification_preferences: { finance: false, tasks: true } }), {
    tasks: true,
    schedule: true,
    finance: false,
    connections: true,
    system: true,
  });
});
