const crypto = require('crypto');
const GoogleCalendarConnection = require('../models/GoogleCalendarConnection');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];

function googleConfig() {
  return {
    clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.GOOGLE_REDIRECT_URI || '').trim(),
  };
}

function isGoogleConfigured() {
  const config = googleConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function tokenKey() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('Google token encryption is not configured');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptTokens(tokens) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptTokens(blob) {
  const [version, ivValue, tagValue, ciphertextValue] = String(blob || '').split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) throw new Error('Stored Google credentials are invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

async function googleRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) {
    const detail = body.error_description || body.error?.message || body.error || 'Google request failed';
    const error = new Error(typeof detail === 'string' ? detail : 'Google request failed');
    error.status = response.status;
    throw error;
  }
  return body;
}

function authorizationUrl(state) {
  const config = googleConfig();
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'select_account consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${query.toString()}`;
}

async function exchangeAuthorizationCode(code) {
  const config = googleConfig();
  const tokens = await googleRequest(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  return {
    ...tokens,
    expiry_date: Date.now() + Number(tokens.expires_in || 3600) * 1000,
  };
}

async function userInfo(accessToken) {
  return googleRequest(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function connectionWithTokens(userId) {
  return GoogleCalendarConnection.findOne({ user_id: userId }).select('+token_blob +accounts.token_blob');
}

function migrateLegacyAccount(connection) {
  if (!connection || connection.accounts.length || !connection.token_blob || !connection.account_email) return false;
  connection.accounts.push({
    account_email: connection.account_email,
    calendar_id: connection.calendar_id || 'primary',
    token_blob: connection.token_blob,
    scopes: connection.scopes || [],
    connected_at: connection.connected_at || connection.createdAt || new Date(),
    last_synced_at: connection.last_synced_at,
    last_error: connection.last_error || '',
  });
  connection.account_email = undefined;
  connection.calendar_id = undefined;
  connection.token_blob = undefined;
  connection.scopes = undefined;
  connection.connected_at = undefined;
  connection.last_synced_at = undefined;
  connection.last_error = undefined;
  return true;
}

async function authorizedConnection(userId, connectionId) {
  const connectionRecord = await connectionWithTokens(userId);
  if (!connectionRecord) {
    const error = new Error('Google Calendar is not connected');
    error.status = 409;
    throw error;
  }

  if (migrateLegacyAccount(connectionRecord)) await connectionRecord.save();
  const connection = connectionRecord.accounts.find((account) => String(account._id) === String(connectionId || ''));
  if (!connection) {
    const error = new Error('Google Calendar account not found');
    error.status = 404;
    throw error;
  }

  let tokens = decryptTokens(connection.token_blob);
  if (tokens.access_token && Number(tokens.expiry_date || 0) > Date.now() + 60_000) {
    return { connection, accessToken: tokens.access_token };
  }
  if (!tokens.refresh_token) {
    const error = new Error('Google Calendar authorization expired. Reconnect your account.');
    error.status = 401;
    throw error;
  }

  const config = googleConfig();
  const refreshed = await googleRequest(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  tokens = {
    ...tokens,
    ...refreshed,
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
    expiry_date: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
  };
  connection.token_blob = encryptTokens(tokens);
  await connectionRecord.save();
  return { connection, accessToken: tokens.access_token };
}

async function calendarRequest(accessToken, path, options = {}) {
  return googleRequest(`${GOOGLE_CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
}

function googleEventTimes(event) {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;
  return { start: start ? new Date(start) : null, end: end ? new Date(end) : null };
}

function scheduleEventBody(item) {
  const start = new Date(item.start_at);
  const end = item.end_at ? new Date(item.end_at) : new Date(start.getTime() + 60 * 60 * 1000);
  return {
    summary: item.title,
    description: item.description || undefined,
    location: item.location || undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: { private: { jdhubScheduleId: String(item._id) } },
  };
}

module.exports = {
  GOOGLE_SCOPES,
  authorizationUrl,
  authorizedConnection,
  calendarRequest,
  decryptTokens,
  encryptTokens,
  exchangeAuthorizationCode,
  googleConfig,
  googleEventTimes,
  isGoogleConfigured,
  migrateLegacyAccount,
  scheduleEventBody,
  userInfo,
};
