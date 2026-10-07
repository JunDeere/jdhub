export const PORTFOLIO_CHANNEL = 'jdeere-portfolio';
export const PORTFOLIO_VERSION = 1;
export const PORTFOLIO_PROJECT = 'jdhub';
export const DEV_PORTFOLIO_ORIGIN = 'http://127.0.0.1:3300';

export const SAFE_DEMO_TARGETS = Object.freeze([
  'dashboard',
  'projects',
  'tasks',
  'scheduling',
  'knowledge-base',
]);

// Reject normalization: configuration must already be a single canonical origin.
export function validatePortfolioParentOrigin(value) {
  if (typeof value !== 'string' || /[\s*]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password
      || url.search || url.hash || url.port === '0') return null;
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(url.hostname)) return null;
    if (url.hostname.length > 253 || url.hostname.split('.').some((label) => label.length > 63)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPortfolioParentOrigin(env = {}) {
  if (env.DEV === true) {
    return env.VITE_PORTFOLIO_DEV_BRIDGE_ENABLED === 'true' ? DEV_PORTFOLIO_ORIGIN : null;
  }
  if (env.PROD !== true || env.VITE_PORTFOLIO_BRIDGE_ENABLED !== 'true') return null;
  return validatePortfolioParentOrigin(env.VITE_PORTFOLIO_PARENT_ORIGIN);
}

const SAFE_TARGETS = new Set(SAFE_DEMO_TARGETS);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function exactObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length && actual.every((field, index) => field === expected[index]);
}

function validEnvelope(data) {
  return data?.channel === PORTFOLIO_CHANNEL
    && data?.version === PORTFOLIO_VERSION
    && data?.projectId === PORTFOLIO_PROJECT
    && typeof data?.requestId === 'string' && UUID.test(data.requestId)
    && typeof data?.nonce === 'string' && UUID.test(data.nonce);
}

export function validatePortfolioInit(data, currentNonce = null) {
  if (!exactObject(data, ['channel', 'version', 'type', 'requestId', 'nonce', 'projectId'])) return null;
  if (!validEnvelope(data) || data.type !== 'portfolio:init') return null;
  if (currentNonce && data.nonce !== currentNonce) return null;
  return { requestId: data.requestId, nonce: data.nonce };
}

export function validatePortfolioCommand(data, currentNonce) {
  if (!exactObject(data, ['channel', 'version', 'type', 'requestId', 'nonce', 'projectId', 'action', 'payload', 'cursor'])) return null;
  if (!validEnvelope(data) || data.type !== 'portfolio:command' || data.nonce !== currentNonce) return null;
  if (data.action !== 'preview.navigate') return { rejected: true, requestId: data.requestId, nonce: data.nonce };
  if (!exactObject(data.payload, ['target']) || !SAFE_TARGETS.has(data.payload.target)) {
    return { rejected: true, requestId: data.requestId, nonce: data.nonce, action: data.action };
  }
  if (!exactObject(data.cursor, ['requested']) || typeof data.cursor.requested !== 'boolean') {
    return { rejected: true, requestId: data.requestId, nonce: data.nonce, action: data.action };
  }
  return {
    requestId: data.requestId,
    nonce: data.nonce,
    action: data.action,
    target: data.payload.target,
    cursorRequested: data.cursor.requested,
  };
}

export function createPortfolioReady(init) {
  return {
    channel: PORTFOLIO_CHANNEL,
    version: PORTFOLIO_VERSION,
    type: 'app:ready',
    requestId: init.requestId,
    nonce: init.nonce,
    projectId: PORTFOLIO_PROJECT,
    capabilities: {
      actions: ['preview.navigate'],
      cursorMode: 'none',
    },
  };
}

export function createPortfolioResult(command, status) {
  return {
    channel: PORTFOLIO_CHANNEL,
    version: PORTFOLIO_VERSION,
    type: 'app:result',
    requestId: command.requestId,
    nonce: command.nonce,
    projectId: PORTFOLIO_PROJECT,
    action: command.action || 'preview.navigate',
    status,
  };
}

// Resolution means the requested page is present, never just that navigation was requested.
export function waitForPortfolioPage({ isRendered, signal, windowRef = window, maxFrames = 20 }) {
  return new Promise((resolve, reject) => {
    let frame;
    const finish = (error) => {
      windowRef.cancelAnimationFrame(frame);
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new Error('Portfolio navigation cancelled'));
    const check = () => {
      if (signal.aborted) return abort();
      if (isRendered()) return finish();
      maxFrames -= 1;
      if (maxFrames <= 0) return finish(new Error('Navigation did not render before the bridge timeout'));
      frame = windowRef.requestAnimationFrame(check);
    };
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    frame = windowRef.requestAnimationFrame(check);
  });
}

export function installPortfolioBridge({ navigate, isDemo, env = import.meta.env, windowRef = window }) {
  const parentOrigin = getPortfolioParentOrigin(env);
  if (isDemo !== true || !parentOrigin || windowRef.parent === windowRef) return () => {};

  let parentNonce = null;
  let active = true;
  const parent = windowRef.parent;
  const pending = new AbortController();
  // Keep IDs for this installation. Fail closed at the cap rather than evicting replay protection.
  const seen = new Set();
  const reply = (message) => {
    if (active) parent.postMessage(message, parentOrigin);
  };
  const receive = async (event) => {
    if (!active || event.origin !== parentOrigin || event.source !== parent) return;

    if (event.data?.type === 'portfolio:init') {
      const init = validatePortfolioInit(event.data, parentNonce);
      if (!init || seen.has(init.requestId) || seen.size >= 4096) return;
      seen.add(init.requestId);
      parentNonce = init.nonce;
      reply(createPortfolioReady(init));
      return;
    }

    if (!parentNonce || event.data?.type !== 'portfolio:command') return;
    const command = validatePortfolioCommand(event.data, parentNonce);
    if (!command || seen.has(command.requestId) || seen.size >= 4096) return;
    seen.add(command.requestId);
    if (command.rejected) {
      reply(createPortfolioResult(command, 'rejected'));
      return;
    }

    try {
      await navigate(command.target, command.cursorRequested, pending.signal);
      reply(createPortfolioResult(command, 'completed'));
    } catch {
      reply(createPortfolioResult(command, 'rejected'));
    }
  };

  windowRef.addEventListener('message', receive);
  return () => {
    active = false;
    parentNonce = null;
    pending.abort();
    seen.clear();
    windowRef.removeEventListener('message', receive);
  };
}
