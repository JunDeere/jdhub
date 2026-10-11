import { Cloud, Plus, RefreshCw, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  startGoogleCalendarConnection,
} from '../api/googleCalendar.js';
import StatusToast from './StatusToast.jsx';

function connectedLabel(value) {
  if (!value) return 'Connected';
  return `Connected ${new Date(value).toLocaleDateString()}`;
}

export default function GoogleCalendarSettings({ token, user }) {
  const [googleStatus, setGoogleStatus] = useState({ configured: true, accounts: [] });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadStatus = async () => {
    const data = await getGoogleCalendarStatus(token);
    setGoogleStatus(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    let feedbackTimer;
    getGoogleCalendarStatus(token)
      .then((data) => { if (!cancelled) setGoogleStatus(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });

    const url = new URL(window.location.href);
    const result = url.searchParams.get('google_calendar');
    if (result) {
      const messages = {
        connected: 'Google Calendar account connected.',
        denied: 'Google Calendar access was cancelled.',
        failed: 'Google Calendar could not be connected.',
        missing_email: 'Google did not provide an email address for this account.',
        missing_token: 'Google did not provide the required offline access. Try connecting again.',
        not_configured: 'Google Calendar is not configured on this server.',
      };
      feedbackTimer = window.setTimeout(() => {
        if (result === 'connected') setSuccess(messages[result]);
        else setError(messages[result] || 'Google Calendar connection failed.');
      }, 0);
      url.searchParams.delete('google_calendar');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    return () => {
      cancelled = true;
      if (feedbackTimer) window.clearTimeout(feedbackTimer);
    };
  }, [token]);

  const connectAccount = async () => {
    setBusy('connect');
    setError(null);
    setSuccess(null);
    try {
      const data = await startGoogleCalendarConnection(token);
      window.location.assign(data.authorizationUrl);
    } catch (requestError) {
      setError(requestError.message);
      setBusy('');
    }
  };

  const disconnectAccount = async (account) => {
    const role = account.isPrimary ? 'main Google account' : 'Google account';
    if (!window.confirm(`Disconnect ${account.accountEmail}, your ${role}? Existing calendar events will not be deleted.`)) return;
    setBusy(account.id);
    setError(null);
    setSuccess(null);
    try {
      await disconnectGoogleCalendar(token, account.id);
      await loadStatus();
      setSuccess(`${account.accountEmail} disconnected.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const accounts = googleStatus.accounts || [];
  const primaryEmail = googleStatus.primaryEmail || user?.email || '';
  const primaryConnected = accounts.some((account) => account.isPrimary);

  return (
    <div className="google-settings">
      <div className="control-row">
        <div>
          <h3>Google Calendar accounts</h3>
          <p className="muted">Connect calendars here, then combine or sync them from Scheduling.</p>
        </div>
        <button
          className="primary-button"
          disabled={googleStatus.configured === false || Boolean(busy)}
          onClick={connectAccount}
          type="button"
        >
          {busy === 'connect' ? <RefreshCw className="spin" size={16} /> : <Plus size={16} />}
          {busy === 'connect' ? 'Opening Google...' : 'Add Google account'}
        </button>
      </div>

      <div className="google-primary-note">
        <Cloud size={17} />
        <div>
          <strong>Main calendar account</strong>
          <span>{primaryEmail}</span>
          <small>Automatically matches the main email saved in your JDHub profile.</small>
        </div>
      </div>

      {!primaryConnected && googleStatus.configured !== false && (
        <div className="alert-warning">
          Connect {primaryEmail} to activate your main Google Calendar. Other addresses will be treated as additional accounts.
        </div>
      )}

      {googleStatus.configured === false && (
        <div className="alert-error">Google Calendar must be configured on the server before accounts can be connected.</div>
      )}

      {accounts.length ? (
        <div className="google-account-list">
          {accounts.map((account) => (
            <article className="google-account-row" key={account.id}>
              <span className="google-calendar-icon"><Cloud size={17} /></span>
              <div>
                <strong>{account.accountEmail}</strong>
                <small>
                  {account.isPrimary ? 'Main account' : 'Additional account'} · {connectedLabel(account.connectedAt)}
                  {account.lastSyncedAt ? ` · Last synced ${new Date(account.lastSyncedAt).toLocaleString()}` : ''}
                </small>
              </div>
              {account.isPrimary && <span className="status-pill success">Main</span>}
              <button
                aria-label={`Disconnect ${account.accountEmail}`}
                className="icon-only-button"
                disabled={Boolean(busy)}
                onClick={() => disconnectAccount(account)}
                title={`Disconnect ${account.accountEmail}`}
                type="button"
              >
                {busy === account.id ? <RefreshCw className="spin" size={16} /> : <Unplug size={16} />}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="google-account-empty">
          <Cloud size={21} />
          <span>No Google Calendar accounts connected yet.</span>
        </div>
      )}

      <StatusToast error={error} success={success} onDismiss={() => { setError(null); setSuccess(null); }} />
    </div>
  );
}
