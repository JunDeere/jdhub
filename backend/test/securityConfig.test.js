const assert = require('node:assert/strict');
const express = require('express');
const { test } = require('node:test');
const {
  apiRateLimit,
  authRateLimit,
  configuredAllowedOrigins,
  corsErrorHandler,
  createCorsMiddleware,
} = require('../config/security');

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('CORS configuration accepts only exact HTTP(S) origins', () => {
  assert.deepEqual(configuredAllowedOrigins({
    CORS_ORIGINS: 'https://jdhub.example.com/, http://localhost:5173',
  }), ['https://jdhub.example.com', 'http://localhost:5173']);

  assert.throws(
    () => configuredAllowedOrigins({ CORS_ORIGINS: '*' }),
    /cannot contain a wildcard/,
  );
  assert.throws(
    () => configuredAllowedOrigins({ CORS_ORIGINS: 'https://jdhub.example.com/api' }),
    /exact HTTP\(S\) origin/,
  );
  assert.throws(
    () => configuredAllowedOrigins({ APP_ENV: 'production' }),
    /must contain at least one exact origin/,
  );
});

test('CORS fails closed for browser origins but permits originless clients', async () => {
  const app = express();
  app.use(createCorsMiddleware({}));
  app.get('/resource', (req, res) => res.json({ ok: true }));
  app.use(corsErrorHandler);
  const { server, baseUrl } = await listen(app);

  try {
    const nativeResponse = await fetch(`${baseUrl}/resource`);
    assert.equal(nativeResponse.status, 200);
    assert.equal(nativeResponse.headers.get('access-control-allow-origin'), null);

    const browserResponse = await fetch(`${baseUrl}/resource`, {
      headers: { origin: 'https://attacker.example' },
    });
    assert.equal(browserResponse.status, 403);
    assert.equal(browserResponse.headers.get('access-control-allow-origin'), null);
    assert.deepEqual(await browserResponse.json(), { error: 'Browser origin is not allowed' });
  } finally {
    await close(server);
  }
});

test('CORS returns credentials only to an explicitly allowed browser origin', async () => {
  const app = express();
  app.use(createCorsMiddleware({ CORS_ORIGINS: 'https://jdhub.example.com' }));
  app.get('/resource', (req, res) => res.json({ ok: true }));
  app.use(corsErrorHandler);
  const { server, baseUrl } = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/resource`, {
      headers: { origin: 'https://jdhub.example.com' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://jdhub.example.com');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  } finally {
    await close(server);
  }
});

test('all API routes are limited and authentication has a stricter cap', async () => {
  const app = express();
  app.use('/api', apiRateLimit({ API_RATE_LIMIT_WINDOW_MS: '60000', API_RATE_LIMIT_MAX: '4' }));
  app.use('/api/auth', authRateLimit({ AUTH_RATE_LIMIT_WINDOW_MS: '60000', AUTH_RATE_LIMIT_MAX: '2' }));
  app.get('/api/auth/check', (req, res) => res.json({ ok: true }));
  app.get('/api/general', (req, res) => res.json({ ok: true }));
  const { server, baseUrl } = await listen(app);

  try {
    assert.equal((await fetch(`${baseUrl}/api/auth/check`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/auth/check`)).status, 200);
    const authLimited = await fetch(`${baseUrl}/api/auth/check`);
    assert.equal(authLimited.status, 429);
    assert.deepEqual(await authLimited.json(), {
      error: 'Too many auth attempts. Please wait and try again.',
    });

    assert.equal((await fetch(`${baseUrl}/api/general`)).status, 200);
    const apiLimited = await fetch(`${baseUrl}/api/general`);
    assert.equal(apiLimited.status, 429);
    assert.deepEqual(await apiLimited.json(), {
      error: 'Too many API requests. Please wait and try again.',
    });
  } finally {
    await close(server);
  }
});
