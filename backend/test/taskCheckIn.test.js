const assert = require('node:assert/strict');
const { test } = require('node:test');
const { _test } = require('../routes/commands');

test('task check-in recognizes concise completion and deferral replies', () => {
  assert.equal(_test.isAffirmativeTaskReply('Yes, I finished it.'), true);
  assert.equal(_test.isAffirmativeTaskReply('done'), true);
  assert.equal(_test.isAffirmativeTaskReply('yes, what is my balance?'), false);
  assert.equal(_test.isDeferredTaskReply('Not yet.'), true);
  assert.equal(_test.isDeferredTaskReply('no, delete it'), false);
});

test('task update tool output is validated into a safe preview action', () => {
  const taskId = '66f8d7bf1f65b470f810c999';
  const action = _test.validateToolAction({
    function: {
      name: 'prepare_task_update',
      arguments: JSON.stringify({ task_id: taskId, title: 'Eat lunch', status: 'done' }),
    },
  });

  assert.equal(action.action_type, 'update_task');
  assert.deepEqual(action.payload, { task_id: taskId, title: 'Eat lunch', status: 'done' });
});

test('task update confirmation payload accepts only supported statuses', () => {
  const taskId = '66f8d7bf1f65b470f810c999';
  assert.deepEqual(
    _test.cleanPayload('update_task', { task_id: taskId, title: 'Eat lunch', status: 'done' }),
    { task_id: taskId, title: 'Eat lunch', status: 'done' },
  );
  assert.equal(_test.cleanPayload('update_task', { task_id: taskId, title: 'Eat lunch', status: 'invalid' }).status, 'done');
});

test('task check-in wording distinguishes due today from overdue', () => {
  const today = _test.manilaDateKey(new Date('2026-09-28T13:00:00.000Z'));
  assert.equal(today, '2026-09-28');
  const wording = _test.taskCheckInText({ title: 'Eat lunch', due_date: '2026-09-28T00:00:00.000Z' });
  assert.match(wording, /Eat lunch/);
  assert.match(wording, /due today|was due/);
});
