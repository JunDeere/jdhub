import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPortfolioReady,
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
