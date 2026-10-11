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

    const existing = await GoogleCalendarConnection.findOne({ user_id: state.userId }).select('+token_blob');
    const tokens = await exchangeAuthorizationCode(String(req.query.code));
    if (!tokens.refresh_token && existing?.token_blob) {
      tokens.refresh_token = decryptTokens(existing.token_blob).refresh_token;
    }
    if (!tokens.access_token || !tokens.refresh_token) return res.redirect(frontendRedirect('missing_token'));

    const profile = await userInfo(tokens.access_token);
    await GoogleCalendarConnection.findOneAndUpdate(
      { user_id: state.userId },
      {
        account_email: profile.email || '',
        calendar_id: 'primary',
        token_blob: encryptTokens(tokens),
        scopes: String(tokens.scope || '').split(' ').filter(Boolean),
        connected_at: new Date(),
        last_error: '',
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return res.redirect(frontendRedirect('connected'));
  } catch (error) {
    console.error('Google Calendar OAuth callback failed:', error.message);
    return res.redirect(frontendRedirect('failed'));
  }
});

router.use(authMiddleware);

router.get('/status', async (req, res) => {
  try {
    const connection = await GoogleCalendarConnection.findOne({ user_id: req.userId });
    res.json({
      configured: isGoogleConfigured(),
      connected: Boolean(connection),
      accountEmail: connection?.account_email || null,
      lastSyncedAt: connection?.last_synced_at || null,
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
    await GoogleCalendarConnection.deleteOne({ user_id: req.userId });
    res.json({ success: true });
  } catch (error) {
    routeError(res, error);
  }
});

router.post('/import', async (req, res) => {
  try {
    const { connection, accessToken } = await authorizedConnection(req.userId);
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
        const existingItem = await ScheduleItem.findOne({
          user_id: req.userId,
          external_provider: 'google',
          external_calendar_id: event.id,
        }).select('sync_source');
        await ScheduleItem.findOneAndUpdate(
          { user_id: req.userId, external_provider: 'google', external_calendar_id: event.id },
          {
            title: event.summary || '(Untitled Google event)',
            description: event.description || '',
            location: event.location || '',
            start_at: start,
            end_at: end && !Number.isNaN(end.getTime()) ? end : undefined,
            all_day: Boolean(event.start?.date),
            status: 'scheduled',
            external_provider: 'google',
            external_calendar_id: event.id,
            external_url: event.htmlLink || '',
            external_updated_at: event.updated ? new Date(event.updated) : undefined,
            sync_source: existingItem?.sync_source === 'jdhub' ? 'jdhub' : 'google',
            sync_last_at: new Date(),
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        );
        imported += 1;
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    connection.last_synced_at = new Date();
    connection.last_error = '';
    await connection.save();
    res.json({ imported, lastSyncedAt: connection.last_synced_at });
  } catch (error) {
    routeError(res, error);
  }
});

router.post('/push', async (req, res) => {
  try {
    const { connection, accessToken } = await authorizedConnection(req.userId);
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
      if (item.external_provider === 'google' && item.external_calendar_id) {
        event = await calendarRequest(
          accessToken,
          `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(item.external_calendar_id)}`,
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
      item.sync_source = 'jdhub';
      item.sync_last_at = new Date();
      await item.save();
    }

    connection.last_synced_at = new Date();
    connection.last_error = '';
    await connection.save();
    res.json({ created, updated, lastSyncedAt: connection.last_synced_at });
  } catch (error) {
    routeError(res, error);
  }
});

module.exports = router;
