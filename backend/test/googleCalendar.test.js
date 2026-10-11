const test = require('node:test');
const assert = require('node:assert/strict');
const {
  authorizationUrl,
  decryptTokens,
  encryptTokens,
  googleEventTimes,
  migrateLegacyAccount,
  scheduleEventBody,
} = require('../services/googleCalendar');

test('encrypts Google OAuth tokens at rest and decrypts them losslessly', () => {
  const previousSecret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'test-only-calendar-encryption-key';
  try {
    const tokens = { access_token: 'access-secret', refresh_token: 'refresh-secret', expiry_date: 12345 };
    const blob = encryptTokens(tokens);
    assert.match(blob, /^v1\./);
    assert.equal(blob.includes('access-secret'), false);
    assert.deepEqual(decryptTokens(blob), tokens);
  } finally {
    if (previousSecret === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = previousSecret;
  }
});

test('builds a Google authorization URL for offline calendar access', () => {
  const previous = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  };
  process.env.GOOGLE_CLIENT_ID = 'client-id';
  process.env.GOOGLE_REDIRECT_URI = 'https://example.com/api/google-calendar/callback';
  try {
    const url = new URL(authorizationUrl('signed-state'));
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.equal(url.searchParams.get('state'), 'signed-state');
    assert.equal(url.searchParams.get('prompt'), 'select_account consent');
    assert.match(url.searchParams.get('scope'), /calendar\.events/);
  } finally {
    if (previous.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previous.clientId;
    if (previous.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
    else process.env.GOOGLE_REDIRECT_URI = previous.redirectUri;
  }
});

test('moves a legacy single Google account into the multi-account collection', () => {
  const accounts = [];
  const connection = {
    accounts,
    account_email: 'first@example.com',
    calendar_id: 'primary',
    token_blob: 'encrypted-token',
    scopes: ['calendar'],
    connected_at: new Date('2026-10-11T00:00:00.000Z'),
  };

  assert.equal(migrateLegacyAccount(connection), true);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].account_email, 'first@example.com');
  assert.equal(accounts[0].token_blob, 'encrypted-token');
  assert.equal(migrateLegacyAccount(connection), false);
});

test('maps timed and all-day Google event dates', () => {
  const timed = googleEventTimes({ start: { dateTime: '2026-10-11T09:00:00+08:00' }, end: { dateTime: '2026-10-11T10:00:00+08:00' } });
  assert.equal(timed.start.toISOString(), '2026-10-11T01:00:00.000Z');
  const allDay = googleEventTimes({ start: { date: '2026-10-11' }, end: { date: '2026-10-12' } });
  assert.equal(allDay.start.toISOString(), '2026-10-11T00:00:00.000Z');
});

test('maps a JDHub schedule item to a Google event body', () => {
  const body = scheduleEventBody({
    _id: 'schedule-1',
    title: 'Planning',
    description: 'Weekly planning',
    location: 'Desk',
    start_at: '2026-10-11T01:00:00.000Z',
    end_at: '2026-10-11T02:00:00.000Z',
  });
  assert.equal(body.summary, 'Planning');
  assert.equal(body.start.dateTime, '2026-10-11T01:00:00.000Z');
  assert.equal(body.extendedProperties.private.jdhubScheduleId, 'schedule-1');
});
