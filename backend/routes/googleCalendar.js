const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const GoogleCalendarConnection = require('../models/GoogleCalendarConnection');
const ScheduleItem = require('../models/ScheduleItem');
const {
  authorizationUrl,
  authorizedConnection,
  calendarRequest,
  decryptTokens,
  encryptTokens,
  exchangeAuthorizationCode,
  googleEventTimes,
  isGoogleConfigured,
  migrateLegacyAccount,
  scheduleEventBody,
  userInfo,
} = require('../services/googleCalendar');

const router = express.Router();

function frontendRedirect(status) {
  const origin = String(process.env.APP_PUBLIC_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  return `${origin}/?google_calendar=${encodeURIComponent(status)}#scheduling`;
}

function routeError(res, error) {
  const status = Number(error.status) || 500;
  res.status(status).json({ error: status >= 500 ? 'Google Calendar request failed' : error.message });
}

function requestedConnectionId(req) {
  return typeof req.body?.connectionId === 'string' ? req.body.connectionId.trim() : '';
}

function publicAccount(account) {
  return {
    id: String(account._id),
    accountEmail: account.account_email,
    calendarId: account.calendar_id,
    connectedAt: account.connected_at,
    lastSyncedAt: account.last_synced_at || null,
    lastError: account.last_error || '',
  };
}

function setGoogleLink(item, connection, event) {
  let link = item.google_calendar_links.find(
    (entry) => String(entry.connection_id) === String(connection._id) && entry.event_id === event.id,
  );
  const values = {
    connection_id: connection._id,
    calendar_id: connection.calendar_id,
    event_id: event.id,
    event_url: event.htmlLink || '',
    event_updated_at: event.updated ? new Date(event.updated) : undefined,
  };
  if (link) Object.assign(link, values);
  else item.google_calendar_links.push(values);
}

router.get('/callback', async (req, res) => {
  try {
    if (!isGoogleConfigured()) return res.redirect(frontendRedirect('not_configured'));
    if (req.query.error) return res.redirect(frontendRedirect('denied'));
    if (!req.query.code || !req.query.state) return res.redirect(frontendRedirect('invalid_callback'));

    const state = jwt.verify(String(req.query.state), process.env.JWT_SECRET, {
      audience: 'google-calendar',
      issuer: 'jdhub',
    });
    if (state.purpose !== 'google_calendar_oauth' || !state.userId) {
      return res.redirect(frontendRedirect('invalid_state'));
    }

    const tokens = await exchangeAuthorizationCode(String(req.query.code));
    if (!tokens.access_token) return res.redirect(frontendRedirect('missing_token'));
    const profile = await userInfo(tokens.access_token);
    const email = String(profile.email || '').trim().toLowerCase();
    if (!email) return res.redirect(frontendRedirect('missing_email'));

    let record = await GoogleCalendarConnection.findOne({ user_id: state.userId })
      .select('+token_blob +accounts.token_blob');
    if (!record) record = new GoogleCalendarConnection({ user_id: state.userId });
    migrateLegacyAccount(record);

    let account = record.accounts.find((candidate) => (
      (profile.sub && candidate.account_subject === profile.sub)
      || candidate.account_email === email
    ));
    if (!tokens.refresh_token && account?.token_blob) {
      tokens.refresh_token = decryptTokens(account.token_blob).refresh_token;
    }
    if (!tokens.refresh_token) return res.redirect(frontendRedirect('missing_token'));

    const values = {
      account_subject: profile.sub || account?.account_subject || '',
      account_email: email,
      calendar_id: account?.calendar_id || 'primary',
      token_blob: encryptTokens(tokens),
      scopes: String(tokens.scope || '').split(' ').filter(Boolean),
      connected_at: new Date(),
      last_error: '',
    };
    if (account) Object.assign(account, values);
    else record.accounts.push(values);

    record.account_email = undefined;
    record.calendar_id = undefined;
    record.token_blob = undefined;
    record.scopes = undefined;
    record.connected_at = undefined;
    record.last_synced_at = undefined;
    record.last_error = undefined;
    await record.save();
    return res.redirect(frontendRedirect('connected'));
  } catch (error) {
    console.error('Google Calendar OAuth callback failed:', error.message);
    return res.redirect(frontendRedirect('failed'));
  }
});

router.use(authMiddleware);

router.get('/status', async (req, res) => {
  try {
    const connection = await GoogleCalendarConnection.findOne({ user_id: req.userId })
      .select('+token_blob +accounts.token_blob');
    if (migrateLegacyAccount(connection)) await connection.save();
    const accounts = (connection?.accounts || [])
      .map(publicAccount)
      .sort((left, right) => new Date(right.connectedAt || 0) - new Date(left.connectedAt || 0));
    res.json({
      configured: isGoogleConfigured(),
      connected: accounts.length > 0,
      accounts,
      accountEmail: accounts[0]?.accountEmail || null,
      lastSyncedAt: accounts[0]?.lastSyncedAt || null,
    });
  } catch (error) {
    routeError(res, error);
  }
});

router.post('/connect', (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(503).json({ error: 'Google Calendar OAuth is not configured on this server' });
  }
  const state = jwt.sign(
    { userId: req.userId, purpose: 'google_calendar_oauth', nonce: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_SECRET,
    { expiresIn: '10m', audience: 'google-calendar', issuer: 'jdhub' },
  );
  return res.json({ authorizationUrl: authorizationUrl(state) });
});

router.post('/disconnect', async (req, res) => {
  try {
    const connectionId = requestedConnectionId(req);
    if (!connectionId) return res.status(400).json({ error: 'Google account is required' });
    const record = await GoogleCalendarConnection.findOne({ user_id: req.userId }).select('+accounts.token_blob');
    const account = record?.accounts.find((candidate) => String(candidate._id) === connectionId);
    if (!account) return res.status(404).json({ error: 'Google Calendar account not found' });
    account.deleteOne();
    if (record.accounts.length) await record.save();
    else await record.deleteOne();
    res.json({ success: true });
  } catch (error) {
    routeError(res, error);
  }
});

router.post('/import', async (req, res) => {
  try {
    const connectionId = requestedConnectionId(req);
    if (!connectionId) return res.status(400).json({ error: 'Google account is required' });
    const { connection, accessToken } = await authorizedConnection(req.userId, connectionId);
    const timeMin = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString();
    let pageToken;
    let imported = 0;

    do {
      const query = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        showDeleted: 'false',
        orderBy: 'startTime',
        maxResults: '2500',
      });
      if (pageToken) query.set('pageToken', pageToken);
      const data = await calendarRequest(accessToken, `/calendars/${encodeURIComponent(connection.calendar_id)}/events?${query}`);
      for (const event of data.items || []) {
        if (!event.id || event.status === 'cancelled') continue;
        const { start, end } = googleEventTimes(event);
        if (!start || Number.isNaN(start.getTime())) continue;
        let existingItem = await ScheduleItem.findOne({
          user_id: req.userId,
          google_calendar_links: {
            $elemMatch: { connection_id: connection._id, event_id: event.id },
          },
        });
        if (!existingItem) {
          existingItem = await ScheduleItem.findOne({
            user_id: req.userId,
            external_provider: 'google',
            external_calendar_id: event.id,
            'google_calendar_links.0': { $exists: false },
          });
        }
        if (!existingItem) existingItem = new ScheduleItem({ user_id: req.userId });

        existingItem.title = event.summary || '(Untitled Google event)';
        existingItem.description = event.description || '';
        existingItem.location = event.location || '';
        existingItem.start_at = start;
        existingItem.end_at = end && !Number.isNaN(end.getTime()) ? end : undefined;
        existingItem.all_day = Boolean(event.start?.date);
        existingItem.status = 'scheduled';
        existingItem.external_provider = 'google';
        existingItem.external_calendar_id = event.id;
        existingItem.external_url = event.htmlLink || '';
        existingItem.external_updated_at = event.updated ? new Date(event.updated) : undefined;
        existingItem.external_account_email = connection.account_email;
        existingItem.sync_source = existingItem.sync_source === 'jdhub' ? 'jdhub' : 'google';
        existingItem.sync_last_at = new Date();
        setGoogleLink(existingItem, connection, event);
        await existingItem.save();
        imported += 1;
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    connection.last_synced_at = new Date();
    connection.last_error = '';
    await connection.parent().save();
    res.json({ imported, accountEmail: connection.account_email, lastSyncedAt: connection.last_synced_at });
  } catch (error) {
    routeError(res, error);
  }
});

router.post('/push', async (req, res) => {
  try {
    const connectionId = requestedConnectionId(req);
    if (!connectionId) return res.status(400).json({ error: 'Google account is required' });
    const { connection, accessToken } = await authorizedConnection(req.userId, connectionId);
    const items = await ScheduleItem.find({
      user_id: req.userId,
      status: { $ne: 'cancelled' },
      sync_source: { $ne: 'google' },
      start_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }).sort({ start_at: 1 }).limit(500);
    let created = 0;
    let updated = 0;

    for (const item of items) {
      const body = JSON.stringify(scheduleEventBody(item));
      let event;
      const existingLink = item.google_calendar_links.find(
        (entry) => String(entry.connection_id) === String(connection._id),
      );
      if (existingLink?.event_id) {
        event = await calendarRequest(
          accessToken,
          `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(existingLink.event_id)}`,
          { method: 'PATCH', body },
        );
        updated += 1;
      } else {
        event = await calendarRequest(
          accessToken,
          `/calendars/${encodeURIComponent(connection.calendar_id)}/events`,
          { method: 'POST', body },
        );
        created += 1;
      }
      item.external_provider = 'google';
      item.external_calendar_id = event.id;
      item.external_url = event.htmlLink || '';
      item.external_updated_at = event.updated ? new Date(event.updated) : undefined;
      item.external_account_email = connection.account_email;
      item.sync_source = 'jdhub';
      item.sync_last_at = new Date();
      setGoogleLink(item, connection, event);
      await item.save();
    }

    connection.last_synced_at = new Date();
    connection.last_error = '';
    await connection.parent().save();
    res.json({ created, updated, accountEmail: connection.account_email, lastSyncedAt: connection.last_synced_at });
  } catch (error) {
    routeError(res, error);
  }
});

module.exports = router;
