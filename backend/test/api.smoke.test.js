const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const { roleForEmail } = require('../services/siteRoles');
const { inspectUpload } = require('../services/fileSecurity');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'jdhub-smoke-test-secret';

test('site owner is administrator and other accounts are members', () => {
  assert.equal(roleForEmail('Jundell.Ggare@gmail.com'), 'admin');
  assert.equal(roleForEmail('member@example.com'), 'member');
});

test('file safety inspection accepts ordinary content and detects disguised executables', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jdhub-file-check-'));
  try {
    const safePath = path.join(directory, 'safe-upload');
    await fs.writeFile(safePath, 'ordinary notes');
    const safe = await inspectUpload(safePath, 'notes.txt');
    assert.equal(safe.allowed, true);
    assert.equal(safe.status, 'checked');
    assert.equal(safe.sha256.length, 64);

    const disguisedPath = path.join(directory, 'disguised-upload');
    await fs.writeFile(disguisedPath, Buffer.from([0x4d, 0x5a, 0x00, 0x00]));
    const disguised = await inspectUpload(disguisedPath, 'invoice.pdf');
    assert.equal(disguised.allowed, false);
    assert.match(disguised.findings[0], /Windows executable/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

const { app } = require('../index');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('health reports the API state without requiring authentication', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.status, 'degraded');
  assert.equal(body.services.api, 'ok');
  assert.equal(body.services.database, 'disconnected');
  assert.ok(!Number.isNaN(Date.parse(body.time)));
});

test('security headers are present', async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
});

test('public registration is disabled before database access', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, 'Account registration is disabled');
});

test('core private routes reject missing bearer tokens', async () => {
  const protectedPaths = [
    '/api/dashboard',
    '/api/tasks',
    '/api/schedule',
    '/api/entries',
    '/api/diary',
    '/api/projects',
    '/api/transactions',
    '/api/finance-forecasts',
    '/api/files',
    '/api/mcp/capabilities',
    '/api/notepad-sync/status',
  ];

  const responses = await Promise.all(protectedPaths.map((path) => fetch(`${baseUrl}${path}`)));

  for (const response of responses) {
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error, 'Unauthorized');
  }
});

test('Notepad bridge credentials cannot be used as normal account credentials', async () => {
  const token = jwt.sign(
    { userId: '6a2fc869103a3fc2486f7081', purpose: 'notepad_bridge' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' },
  );
  const response = await fetch(`${baseUrl}/api/tasks`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, 'Invalid token');
});

test('normal account credentials cannot submit Notepad bridge snapshots', async () => {
  const token = jwt.sign({ userId: '6a2fc869103a3fc2486f7081' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const response = await fetch(`${baseUrl}/api/notepad-sync`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, 'Invalid bridge token');
});

test('core private routes reject invalid bearer tokens', async () => {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    headers: { authorization: 'Bearer invalid-token' },
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, 'Invalid token');
});
