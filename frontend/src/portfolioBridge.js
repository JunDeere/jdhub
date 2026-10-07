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
    && UUID.test(data?.requestId || '')
    && UUID.test(data?.nonce || '');
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

export function installPortfolioBridge({ navigate }) {
  if (!import.meta.env.DEV || window.parent === window) return () => {};

  let parentNonce = null;
  const reply = (message) => window.parent.postMessage(message, DEV_PORTFOLIO_ORIGIN);
  const receive = async (event) => {
    if (event.origin !== DEV_PORTFOLIO_ORIGIN || event.source !== window.parent) return;

    if (event.data?.type === 'portfolio:init') {
      const init = validatePortfolioInit(event.data, parentNonce);
      if (!init) return;
      parentNonce = init.nonce;
      reply(createPortfolioReady(init));
      return;
    }

    if (!parentNonce || event.data?.type !== 'portfolio:command') return;
    const command = validatePortfolioCommand(event.data, parentNonce);
    if (!command) return;
    if (command.rejected) {
      reply(createPortfolioResult(command, 'rejected'));
      return;
    }

    try {
      await navigate(command.target, command.cursorRequested);
      reply(createPortfolioResult(command, 'completed'));
    } catch {
      reply(createPortfolioResult(command, 'rejected'));
    }
  };

  window.addEventListener('message', receive);
  return () => {
    parentNonce = null;
    window.removeEventListener('message', receive);
  };
}
