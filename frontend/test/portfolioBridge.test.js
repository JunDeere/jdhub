import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPortfolioReady,
  getPortfolioParentOrigin,
  installPortfolioBridge,
  validatePortfolioParentOrigin,
  waitForPortfolioPage,
  SAFE_DEMO_TARGETS,
  createPortfolioResult,
  validatePortfolioCommand,
  validatePortfolioInit,
} from '../src/portfolioBridge.js';

const nonce = '247b1f5c-3a91-4f4c-8ef0-0dc97d334dee';
const initRequestId = 'db051ccd-63d6-4815-9bd0-e3c74957f25f';
const commandRequestId = '8b67da52-921a-45b6-8505-13ff75ad5f67';

test('accepts the canonical JDHub init example and binds its in-memory nonce', () => {
  assert.deepEqual(validatePortfolioInit({
    channel: 'jdeere-portfolio',
    version: 1,
    type: 'portfolio:init',
    requestId: initRequestId,
    nonce,
    projectId: 'jdhub',
  }), { requestId: initRequestId, nonce });
});

test('accepts canonical navigation only for approved safe demo targets', () => {
  const command = {
    channel: 'jdeere-portfolio',
    version: 1,
    type: 'portfolio:command',
    requestId: commandRequestId,
    nonce,
    projectId: 'jdhub',
    action: 'preview.navigate',
    payload: { target: 'tasks' },
    cursor: { requested: true },
  };
  assert.deepEqual(validatePortfolioCommand(command, nonce), {
    requestId: commandRequestId,
    nonce,
    action: 'preview.navigate',
    target: 'tasks',
    cursorRequested: true,
  });
});

test('produces canonical data-free ready and result messages', () => {
  assert.deepEqual(createPortfolioReady({ requestId: initRequestId, nonce }), {
    channel: 'jdeere-portfolio', version: 1, type: 'app:ready', requestId: initRequestId,
    nonce, projectId: 'jdhub', capabilities: { actions: ['preview.navigate'], cursorMode: 'none' },
  });
  assert.deepEqual(createPortfolioResult({ requestId: commandRequestId, nonce, action: 'preview.navigate' }, 'completed'), {
    channel: 'jdeere-portfolio', version: 1, type: 'app:result', requestId: commandRequestId,
    nonce, projectId: 'jdhub', action: 'preview.navigate', status: 'completed',
  });
});

test('rejects private modules and every write-shaped action', () => {
  for (const target of ['diary', 'finance', 'files', 'server-manager', 'security', 'integrations']) {
    const result = validatePortfolioCommand({
      channel: 'jdeere-portfolio', version: 1, type: 'portfolio:command', requestId: commandRequestId,
      nonce, projectId: 'jdhub', action: 'preview.navigate', payload: { target }, cursor: { requested: true },
    }, nonce);
    assert.equal(result.rejected, true);
  }
  const write = validatePortfolioCommand({
    channel: 'jdeere-portfolio', version: 1, type: 'portfolio:command', requestId: commandRequestId,
    nonce, projectId: 'jdhub', action: 'task.create', payload: { target: 'tasks' }, cursor: { requested: false },
  }, nonce);
  assert.equal(write.rejected, true);
});

test('silently drops wrong nonce, project, version, and extra schema fields', () => {
  const base = {
    channel: 'jdeere-portfolio', version: 1, type: 'portfolio:command', requestId: commandRequestId,
    nonce, projectId: 'jdhub', action: 'preview.navigate', payload: { target: 'tasks' }, cursor: { requested: false },
  };
  assert.equal(validatePortfolioCommand({ ...base, nonce: initRequestId }, nonce), null);
  assert.equal(validatePortfolioCommand({ ...base, projectId: 'other' }, nonce), null);
  assert.equal(validatePortfolioCommand({ ...base, version: 2 }, nonce), null);
  assert.equal(validatePortfolioCommand({ ...base, token: 'must-not-be-accepted' }, nonce), null);
});

// Inject the environment and browser so tests never enable a deployed build.
const prodEnv = { PROD: true, DEV: false, VITE_PORTFOLIO_BRIDGE_ENABLED: 'true', VITE_PORTFOLIO_PARENT_ORIGIN: 'https://jdeere.net' };
const init = { channel: 'jdeere-portfolio', version: 1, type: 'portfolio:init', requestId: initRequestId, nonce, projectId: 'jdhub' };
const command = { ...init, type: 'portfolio:command', requestId: commandRequestId, action: 'preview.navigate', payload: { target: 'tasks' }, cursor: { requested: true } };
function harness(options = {}) {
  const messages = [];
  const listeners = new Set();
  const calls = [];
  const parent = { postMessage: (data, origin) => messages.push({ data, origin }) };
  const windowRef = { parent, addEventListener: (name, fn) => listeners.add(fn), removeEventListener: (name, fn) => listeners.delete(fn) };
  if (options.topLevel) windowRef.parent = windowRef;
  const stop = installPortfolioBridge({ isDemo: true, env: prodEnv, navigate: (...args) => { calls.push(args); }, ...options, windowRef });
  const send = (data, extra = {}) => Promise.all([...listeners].map((fn) => fn({ data, source: parent, origin: 'https://jdeere.net', ...extra })));
  return { messages, listeners, calls, stop, send };
}

test('production origin is exact canonical HTTPS, never a URL, wildcard or normalized spelling', () => {
  for (const good of ['https://jdeere.net', 'https://portfolio.example.com', 'https://jdeere.net:8443']) assert.equal(validatePortfolioParentOrigin(good), good);
  for (const bad of [undefined, null, true, '', 'https://jdeere.net/', 'http://jdeere.net', 'https://*.jdeere.net', '*', 'https://jdeere.net/path', 'https://jdeere.net?x', 'https://jdeere.net#x', 'https://user@jdeere.net', 'https://user:pass@jdeere.net', ' https://jdeere.net', 'https://jdeere.net\n', 'https://jdee\tre.net', 'HTTPS://jdeere.net', 'https://JDEERE.net', 'https://jdeere.net:443', 'https://jdeere.net:0443', 'https://jdeere.net:', 'https://jdeere.net:0', 'https://jdeere.net:99999', 'https://jdeere.net:-1', 'https://jdeere.net:+443', 'https://jdeere.net:8443.0', 'https://jdeere.net\\evil', 'https://jdeere.net.', 'https://foo_bar.net', 'https://%6adeere.net', 'null', 'https://jdeere.net,https://evil.test']) assert.equal(validatePortfolioParentOrigin(bad), null, String(bad));
});

test('both modes default off; exact opt-in flags are independent and fail closed', () => {
  for (const env of [{}, { PROD: true }, { DEV: true }, { ...prodEnv, VITE_PORTFOLIO_BRIDGE_ENABLED: 'false' }, { ...prodEnv, VITE_PORTFOLIO_PARENT_ORIGIN: '' }]) assert.equal(getPortfolioParentOrigin(env), null);
  for (const flag of [true, 1, '1', 'TRUE', ' true', 'true ']) {
    assert.equal(getPortfolioParentOrigin({ ...prodEnv, VITE_PORTFOLIO_BRIDGE_ENABLED: flag }), null);
    assert.equal(getPortfolioParentOrigin({ DEV: true, VITE_PORTFOLIO_DEV_BRIDGE_ENABLED: flag }), null);
  }
  assert.equal(getPortfolioParentOrigin(prodEnv), 'https://jdeere.net');
  assert.equal(getPortfolioParentOrigin({ ...prodEnv, DEV: true }), null);
  assert.equal(getPortfolioParentOrigin({ DEV: true, VITE_PORTFOLIO_DEV_BRIDGE_ENABLED: 'true', VITE_PORTFOLIO_PARENT_ORIGIN: 'https://evil.test' }), 'http://127.0.0.1:3300');
  assert.equal(getPortfolioParentOrigin({ PROD: true, VITE_PORTFOLIO_DEV_BRIDGE_ENABLED: 'true' }), null);
});

test('installer requires explicit demo identity, config and iframe', () => {
  for (const isDemo of [undefined, false, 'true', 1, null]) assert.equal(harness({ isDemo }).listeners.size, 0);
  assert.equal(harness({ topLevel: true }).listeners.size, 0);
  assert.equal(harness({ env: {} }).listeners.size, 0);
  assert.equal(harness({ env: { ...prodEnv, VITE_PORTFOLIO_PARENT_ORIGIN: '*' } }).listeners.size, 0);
});

test('checks exact origin and parent source before init or command and replies only to configured origin', async () => {
  const h = harness();
  await h.send(command);
  for (const origin of ['null', 'http://127.0.0.1:3300', 'http://jdeere.net', 'https://evil.test', 'https://jdeere.net.evil.test', 'https://jdeere.net:8443']) await h.send(init, { origin });
  await h.send(init, { source: {} });
  assert.equal(h.messages.length, 0);
  await h.send(init);
  await h.send(command, { source: {} });
  await h.send(command, { origin: 'https://evil.test' });
  assert.equal(h.calls.length, 0);
  await h.send(command);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.messages.map((m) => m.data.type), ['app:ready', 'app:result']);
  assert.ok(h.messages.every((m) => m.origin === 'https://jdeere.net'));
  h.stop();
});

test('dev installation accepts only fixed loopback parent, not localhost or production', async () => {
  const h = harness({ env: { DEV: true, VITE_PORTFOLIO_DEV_BRIDGE_ENABLED: 'true' } });
  await h.send(init);
  await h.send(init, { origin: 'http://localhost:3300' });
  assert.equal(h.messages.length, 0);
  await h.send(init, { origin: 'http://127.0.0.1:3300' });
  assert.equal(h.messages[0].origin, 'http://127.0.0.1:3300');
  h.stop();
});

test('pins nonce, deduplicates init and in-flight/completed command IDs', async () => {
  let complete;
  let calls = 0;
  const h = harness({ navigate: () => { calls++; return new Promise((resolve) => { complete = resolve; }); } });
  await h.send(init);
  await h.send(init);
  await h.send({ ...init, nonce: commandRequestId, requestId: commandRequestId });
  await h.send({ ...command, nonce: commandRequestId });
  const pending = h.send(command);
  await h.send(command);
  assert.equal(calls, 1);
  assert.equal(h.messages.length, 1);
  complete();
  await pending;
  await h.send(command);
  assert.equal(calls, 1);
  assert.equal(h.messages.length, 2);
  h.stop();
});

test('cleanup aborts work, removes listener and suppresses both late success and failure', async () => {
  for (const fail of [false, true]) {
    let settle;
    let signal;
    const h = harness({ navigate: (target, cursor, incomingSignal) => {
      signal = incomingSignal;
      return new Promise((resolve, reject) => { settle = fail ? reject : resolve; });
    } });
    await h.send(init);
    const pending = h.send(command);
    h.stop(); h.stop();
    assert.equal(signal.aborted, true);
    assert.equal(h.listeners.size, 0);
    settle(); await pending;
    await h.send(init);
    assert.equal(h.messages.length, 1);
  }
});

test('navigation errors produce rejected rather than completed', async () => {
  const h = harness({ navigate: () => { throw new Error('not rendered'); } });
  await h.send(init); await h.send(command);
  assert.equal(h.messages[1].data.status, 'rejected');
  h.stop();
});

test('only canonical five targets accepted; no data/context/write capability', async () => {
  assert.deepEqual(SAFE_DEMO_TARGETS, ['dashboard', 'projects', 'tasks', 'scheduling', 'knowledge-base']);
  for (const target of SAFE_DEMO_TARGETS) assert.equal(validatePortfolioCommand({ ...command, payload: { target } }, nonce).target, target);
  for (const change of [{ payload: { target: 'tasks', context: {} } }, { cursor: { requested: 'true' } }, { cursor: { requested: true, x: 1 } }, { action: 'context.read' }, { action: 'task.delete' }, { payload: { target: 'knowledge' } }]) assert.equal(validatePortfolioCommand({ ...command, ...change }, nonce).rejected, true);
  for (const change of [{ channel: 'other' }, { nonce: 'bad' }, { requestId: 'bad' }, { requestId: [commandRequestId] }, { version: '1' }, { context: {} }]) assert.equal(validatePortfolioCommand({ ...command, ...change }, nonce), null);
  for (const change of [{ token: 'secret' }, { nonce: [nonce] }, { projectId: 'other' }, { version: 2 }]) assert.equal(validatePortfolioInit({ ...init, ...change }), null);
  const h = harness(); await h.send(init); await h.send({ ...command, action: 'context.read' });
  assert.equal(h.calls.length, 0);
  assert.deepEqual(Object.keys(h.messages[1].data).sort(), ['channel', 'version', 'type', 'requestId', 'nonce', 'projectId', 'action', 'status'].sort());
  h.stop();
});

function frames() {
  const queued = new Map(); let id = 0;
  return { queued, requestAnimationFrame: (fn) => { queued.set(++id, fn); return id; }, cancelAnimationFrame: (key) => queued.delete(key), tick: () => { const batch = [...queued.values()]; queued.clear(); batch.forEach((fn) => fn()); } };
}
test('render confirmation waits for actual rendered target', async () => {
  const windowRef = frames(); const controller = new AbortController(); let rendered = false; let done = false;
  const pending = waitForPortfolioPage({ windowRef, signal: controller.signal, isRendered: () => rendered }).then(() => { done = true; });
  windowRef.tick(); await Promise.resolve(); assert.equal(done, false);
  rendered = true; windowRef.tick(); await pending;
  assert.equal(done, true); assert.equal(windowRef.queued.size, 0);
});
test('missing render times out and abort cancels queued animation frames', async () => {
  const windowRef = frames(); const controller = new AbortController();
  const pending = waitForPortfolioPage({ windowRef, signal: controller.signal, isRendered: () => false, maxFrames: 2 });
  const rejected = assert.rejects(pending, /timeout/);
  windowRef.tick(); windowRef.tick(); await rejected; assert.equal(windowRef.queued.size, 0);
  const pendingAbort = waitForPortfolioPage({ windowRef, signal: controller.signal, isRendered: () => false });
  const aborted = assert.rejects(pendingAbort, /cancelled/); controller.abort(); await aborted;
  assert.equal(windowRef.queued.size, 0);
  await assert.rejects(waitForPortfolioPage({ windowRef, signal: controller.signal, isRendered: () => true }), /cancelled/);
});

test('replay capacity fails closed without dropping already seen IDs', async () => {
  const h = harness();
  await h.send(init);
  for (let i = 0; i < 4095; i++) {
    const requestId = `${i.toString(16).padStart(8, '0')}-63d6-4815-9bd0-e3c74957f25f`;
    await h.send({ ...init, requestId });
  }
  assert.equal(h.messages.length, 4096);
  await h.send(command);
  await h.send(init);
  assert.equal(h.calls.length, 0);
  assert.equal(h.messages.length, 4096);
  h.stop();
});

test('overlong DNS labels and hostnames fail closed', () => {
  assert.equal(validatePortfolioParentOrigin(`https://${'x'.repeat(64)}.test`), null);
  assert.equal(validatePortfolioParentOrigin(`https://${Array(5).fill('x'.repeat(63)).join('.')}`), null);
});
