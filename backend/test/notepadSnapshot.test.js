const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const NoteSyncSnapshot = require('../models/NoteSyncSnapshot');

test('Notepad recovery snapshots accept empty state sidecar files', async () => {
  const snapshot = new NoteSyncSnapshot({
    user_id: new mongoose.Types.ObjectId(),
    state_hash: 'a'.repeat(64),
    captured_at: new Date('2026-10-11T00:00:00.000Z'),
    files: [{
      name: 'd9d087ae-f24d-4d07-92af-2e1d72a13f33.1.bin',
      modified_at: new Date('2026-10-06T00:00:00.000Z'),
      data: Buffer.alloc(0),
    }],
  });

  await assert.doesNotReject(() => snapshot.validate());
  assert.equal(snapshot.files[0].data.length, 0);
});
