const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../routes/commands');

test('confirmation schema rejects unknown fields and target swapping', () => {
  assert.throws(
    () => _test.validateConfirmationPayload('create_task', { title: 'Fictional task', secret: 'nope' }),
    /Unexpected action field/,
  );
  assert.throws(
    () => _test.validateConfirmationPayload(
      'update_task',
      { task_id: '507f1f77bcf86cd799439012', title: 'Fictional task', status: 'done' },
      { task_id: '507f191e810c19729de860ea' },
    ),
    /target task cannot be changed/i,
  );
});

test('confirmation schema accepts a bounded fictional task proposal', () => {
  assert.deepEqual(
    _test.validateConfirmationPayload('create_task', {
      title: 'Review fictional launch checklist',
      description: 'Use sample data only.',
      status: 'todo',
      priority: 'high',
      category: 'Demo',
      due_date: '',
      tags: ['fictional'],
    }),
    {
      title: 'Review fictional launch checklist',
      description: 'Use sample data only.',
      status: 'todo',
      priority: 'high',
      category: 'Demo',
      due_date: undefined,
      tags: ['fictional'],
    },
  );
});

test('mock provider creates deterministic module-bounded read answers', () => {
  const answer = _test.buildMockAnswer(
    'What is next?',
    { tasks: [{ title: 'Fictional review', priority: 'high' }] },
    { label: 'Tasks', moduleId: 'tasks' },
  );
  assert.equal(answer, 'Tasks: 1 open task. Highest priority: "Fictional review" (high).');
});
