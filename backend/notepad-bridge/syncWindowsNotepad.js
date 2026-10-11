const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const dotenv = require('dotenv');
const { parseNotepadState } = require('./notepadStateParser');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.notepad-bridge'), quiet: true });

const stateDirectory = process.env.NOTEPAD_STATE_DIR
  || path.join(process.env.LOCALAPPDATA || '', 'Packages', 'Microsoft.WindowsNotepad_8wekyb3d8bbwe', 'LocalState', 'TabState');
const apiBase = (process.env.JDHUB_API_BASE || 'http://localhost:3001').replace(/\/$/, '');
const intervalMs = Math.max(Number(process.env.NOTEPAD_SYNC_INTERVAL_MS) || 15000, 5000);
const controlPort = Math.max(Number(process.env.NOTEPAD_BRIDGE_PORT) || 38471, 1);
const allowedOrigins = new Set(
  String(process.env.NOTEPAD_BRIDGE_ALLOWED_ORIGINS || 'https://jdhub.jdeere.net,http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function firstLine(content) {
  return String(content || '').split(/\r?\n/)[0].trim().slice(0, 180);
}

async function readState() {
  const names = (await fs.promises.readdir(stateDirectory))
    .filter((name) => /^[0-9a-f-]+(?:\.[01])?\.bin$/i.test(name))
    .sort();
  const hash = crypto.createHash('sha256');
  const rawFiles = [];
  const notes = [];
  const parseFailures = [];

  for (const name of names) {
    const filePath = path.join(stateDirectory, name);
    const [data, stat] = await Promise.all([fs.promises.readFile(filePath), fs.promises.stat(filePath)]);
    hash.update(name);
    hash.update(data);
    rawFiles.push({ name, modified_at: stat.mtime.toISOString(), data_base64: data.toString('base64') });

    if (/\.[01]\.bin$/i.test(name)) continue;
    try {
      const parsed = parseNotepadState(data, name);
      if (!parsed.content.trim()) continue;
      notes.push({
        source_id: parsed.sourceId,
        source_name: parsed.sourceName,
        title: firstLine(parsed.content) || parsed.sourceName,
        content: parsed.content,
        modified_at: (parsed.modifiedAt || stat.mtime).toISOString(),
      });
    } catch (error) {
      parseFailures.push({ sourceId: path.basename(name, '.bin'), error: error.message });
    }
  }

  return { stateHash: hash.digest('hex'), rawFiles, notes, parseFailures };
}

async function syncOnce() {
  if (!process.env.JDHUB_NOTEPAD_BRIDGE_TOKEN) {
    throw new Error('JDHUB_NOTEPAD_BRIDGE_TOKEN is missing from backend/.env.notepad-bridge');
  }
  if (!fs.existsSync(stateDirectory)) throw new Error('Windows Notepad session folder was not found');

  const state = await readState();
  const response = await fetch(`${apiBase}/api/notepad-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.JDHUB_NOTEPAD_BRIDGE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      state_hash: state.stateHash,
      captured_at: new Date().toISOString(),
      notepad_version: process.env.NOTEPAD_VERSION || 'unknown',
      notes: state.notes,
      raw_files: state.rawFiles,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `JDHub returned ${response.status}`);

  const result = {
    synced: body.synced,
    reason: body.reason || null,
    noteCount: state.notes.length,
    snapshotFileCount: state.rawFiles.length,
    parseFailureCount: state.parseFailures.length,
    machine: os.hostname(),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (state.parseFailures.length) process.stderr.write(`Skipped ${state.parseFailures.length} unreadable Notepad state file(s). Raw copies were still backed up.\n`);
  return result;
}

let activeSync = null;

function runSync() {
  if (!activeSync) {
    activeSync = syncOnce().finally(() => {
      activeSync = null;
    });
  }
  return activeSync;
}

function sendJson(response, status, body, origin = null) {
  response.statusCode = status;
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function startControlServer() {
  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin || null;
    const originAllowed = !origin || allowedOrigins.has(origin);

    if (!originAllowed) {
      sendJson(response, 403, { error: 'This site is not allowed to control the Notepad bridge' });
      return;
    }

    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-JDHub-Bridge');
      response.setHeader('Access-Control-Allow-Private-Network', 'true');
      response.setHeader('Access-Control-Max-Age', '600');
      response.end();
      return;
    }

    if (request.method === 'GET' && request.url === '/status') {
      sendJson(response, 200, { online: true, machine: os.hostname(), syncing: Boolean(activeSync) }, origin);
      return;
    }

    if (request.method === 'POST' && request.url === '/sync') {
      if (request.headers['x-jdhub-bridge'] !== '1') {
        sendJson(response, 400, { error: 'Missing JDHub bridge request header' }, origin);
        return;
      }

      try {
        sendJson(response, 200, await runSync(), origin);
      } catch (error) {
        sendJson(response, 502, { error: error.message }, origin);
      }
      return;
    }

    sendJson(response, 404, { error: 'Not found' }, origin);
  });

  server.listen(controlPort, '127.0.0.1', () => {
    process.stdout.write(`Notepad bridge controls listening on http://127.0.0.1:${controlPort}\n`);
  });
  server.on('error', (error) => {
    process.stderr.write(`Notepad bridge control server failed: ${error.message}\n`);
  });
}

async function main() {
  if (process.argv.includes('--once')) {
    await syncOnce();
    return;
  }

  startControlServer();
  runSync().catch((error) => {
    process.stderr.write(`Notepad backup failed: ${error.message}\n`);
  });
  setInterval(() => {
    runSync().catch((error) => {
      process.stderr.write(`Notepad backup failed: ${error.message}\n`);
    });
  }, intervalMs);
}

main().catch((error) => {
  process.stderr.write(`Notepad backup failed: ${error.message}\n`);
  process.exitCode = 1;
});
