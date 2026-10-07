const test = require('node:test');
const assert = require('node:assert/strict');
const {
  actionAllowed,
  assertActionScope,
  contextCounts,
  modulePolicy,
  normalizeModule,
  requestedModule,
} = require('../services/assistantPolicy');

test('normalizes unknown module input to the private command center', () => {
  assert.equal(normalizeModule('TASKS'), 'tasks');
  assert.equal(normalizeModule('made-up'), 'command-center');
  assert.equal(normalizeModule({}), 'command-center');
});

test('rejects an explicitly unknown module at the request boundary', () => {
  assert.equal(requestedModule(undefined), 'command-center');
  assert.equal(requestedModule('TASKS'), 'tasks');
  assert.throws(() => requestedModule('made-up'), /Unknown assistant module/);
});

test('keeps encrypted and operational modules out of AI context', () => {
  for (const moduleId of ['diary', 'files', 'security', 'server-manager', 'integrations', 'settings']) {
    const policy = modulePolicy(moduleId);
    assert.deepEqual(policy.context, []);
    assert.match(policy.privateReason, /excluded|never sent/i);
  }
});

test('allows typed mutations only in their module or command center', () => {
  assert.equal(actionAllowed('tasks', 'create_task'), true);
  assert.equal(actionAllowed('command-center', 'create_transaction'), true);
  assert.equal(actionAllowed('finance', 'create_task'), false);
  assert.throws(() => assertActionScope('projects', 'create_task'), /cannot propose/i);
  assert.throws(() => assertActionScope('tasks', 'delete_task'), /unsupported/i);
});

test('returns metadata counts without exposing records', () => {
  assert.deepEqual(contextCounts({ tasks: [{ title: 'Fictional task' }], financeForecast: null }), {
    tasks: 1,
    financeForecast: 0,
  });
});
