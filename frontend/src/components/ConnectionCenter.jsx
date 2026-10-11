import {
  CalendarSync,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Copy,
  Laptop,
  RefreshCw,
  StickyNote,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLocalNotepadBridgeStatus,
  getNotepadSyncStatus,
  retrieveWindowsNotepadNotes,
} from '../api/notepadSync.js';
import GoogleCalendarSettings from './GoogleCalendarSettings.jsx';
import StatusToast from './StatusToast.jsx';

const RESTART_COMMAND = 'Start-ScheduledTask -TaskName "JDHub Notepad Backup"';

function timestamp(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function StatusBadge({ state, children }) {
  return <span className={`connection-state ${state}`}>{children}</span>;
}

export default function ConnectionCenter({ token, user, onNavigate }) {
  const [googleStatus, setGoogleStatus] = useState(null);
  const [serverBridge, setServerBridge] = useState(null);
  const [localBridge, setLocalBridge] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadDesktopStatus = useCallback(async () => {
    const [server, local] = await Promise.all([
      getNotepadSyncStatus(token),
      getLocalNotepadBridgeStatus(),
    ]);
    setServerBridge(server);
    setLocalBridge(local);
    return { server, local };
  }, [token]);

  useEffect(() => {
    let active = true;
    Promise.all([getNotepadSyncStatus(token), getLocalNotepadBridgeStatus()])
      .then(([server, local]) => {
        if (!active) return;
        setServerBridge(server);
        setLocalBridge(local);
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [token]);

  const googleAccounts = useMemo(() => googleStatus?.accounts || [], [googleStatus]);
  const googleNeedsAttention = googleStatus?.configured === false
    || (googleStatus !== null && googleAccounts.length === 0)
    || googleAccounts.some((account) => account.lastError);
  const localOnline = localBridge?.online === true;
  const desktopHasHistory = serverBridge?.connected === true;
  const connectedServices = Number(googleAccounts.length > 0) + Number(localOnline);
  const attentionCount = Number(googleNeedsAttention) + Number(!localOnline);

  const latestGoogleSync = useMemo(() => googleAccounts
    .map((account) => account.lastSyncedAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right) - new Date(left))[0] || null, [googleAccounts]);

  const refreshAll = async () => {
    setBusy('refresh');
    setError(null);
    setSuccess(null);
    try {
      await loadDesktopStatus();
      setRefreshKey((current) => current + 1);
      setSuccess('Connection status refreshed.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const syncNotepad = async () => {
    setBusy('notepad');
    setError(null);
    setSuccess(null);
    try {
      const result = await retrieveWindowsNotepadNotes();
      await loadDesktopStatus();
      setSuccess(result.synced === false ? 'Desktop notes are already current.' : `${result.noteCount || 0} desktop notes backed up.`);
    } catch (requestError) {
      setError(requestError.message);
      await loadDesktopStatus().catch(() => {});
    } finally {
      setBusy('');
    }
  };

  const copyRestartCommand = async () => {
    try {
      await navigator.clipboard.writeText(RESTART_COMMAND);
      setSuccess('Windows bridge restart command copied.');
      setError(null);
    } catch {
      setError(`Copy this in PowerShell: ${RESTART_COMMAND}`);
    }
  };

  return (
    <div className="connection-center">
      <div className="connection-center-heading">
        <div>
          <p className="eyebrow">Connection Center</p>
          <h3>Accounts and desktop links</h3>
          <p>See what is connected, when it last synced, and where attention is needed.</p>
        </div>
        <button className="secondary-button" disabled={Boolean(busy)} onClick={refreshAll} type="button">
          <RefreshCw className={busy === 'refresh' ? 'spin' : ''} size={16} /> Refresh status
        </button>
      </div>

      <div className="connection-overview" aria-label="Connection summary">
        <article>
          <span><CheckCircle2 size={18} /></span>
          <div><small>Connected now</small><strong>{connectedServices} of 2 services</strong></div>
        </article>
        <article>
          <span><CircleAlert size={18} /></span>
          <div><small>Needs attention</small><strong>{attentionCount}</strong></div>
        </article>
        <article>
          <span><CalendarSync size={18} /></span>
          <div><small>Latest Google sync</small><strong>{timestamp(latestGoogleSync)}</strong></div>
        </article>
        <article>
          <span><StickyNote size={18} /></span>
          <div><small>Latest desktop backup</small><strong>{timestamp(serverBridge?.latest?.captured_at)}</strong></div>
        </article>
      </div>

      <section className="connection-card">
        <div className="connection-card-heading">
          <span className="connection-card-icon"><Laptop size={20} /></span>
          <div><h4>Windows desktop bridge</h4><p>Read-only backup link for Windows 11 Notepad tabs.</p></div>
          {localOnline ? <StatusBadge state="online">Online</StatusBadge> : <StatusBadge state="offline">Offline</StatusBadge>}
        </div>

        <div className="desktop-connection-details">
          <div><span>Computer</span><strong>{localBridge?.machine || 'This browser cannot reach the bridge'}</strong></div>
          <div><span>Local process</span><strong>{localOnline ? (localBridge.syncing ? 'Syncing now' : 'Ready') : 'Not detected'}</strong></div>
          <div><span>Backed-up notes</span><strong>{serverBridge?.desktopNoteCount || 0}</strong></div>
          <div><span>Last server snapshot</span><strong>{timestamp(serverBridge?.latest?.captured_at)}</strong></div>
        </div>

        {!localOnline && (
          <div className="connection-help">
            <CircleAlert size={18} />
            <div><strong>The bridge is not running on this PC</strong><p>Open PowerShell and start the existing “JDHub Notepad Backup” scheduled task. Old backups remain safe in JDHub.</p></div>
            <button className="secondary-button" onClick={copyRestartCommand} type="button"><Copy size={15} />Copy restart command</button>
          </div>
        )}

        {localOnline && !desktopHasHistory && <div className="alert-warning">The bridge is online but has not created its first server backup yet. Run Sync now.</div>}

        <div className="connection-actions">
          <button className="primary-button" disabled={!localOnline || Boolean(busy)} onClick={syncNotepad} type="button">
            <RefreshCw className={busy === 'notepad' ? 'spin' : ''} size={16} />{busy === 'notepad' ? 'Syncing…' : 'Sync now'}
          </button>
          <button className="secondary-button" onClick={() => onNavigate('life-log')} type="button"><StickyNote size={16} />Open Notes</button>
        </div>
      </section>

      <section className="connection-card">
        <div className="connection-card-heading compact">
          <span className="connection-card-icon"><Cloud size={20} /></span>
          <div><h4>Google Calendar</h4><p>OAuth accounts used by JDHub Scheduling.</p></div>
          {googleAccounts.length
            ? <StatusBadge state={googleNeedsAttention ? 'warning' : 'online'}>{googleAccounts.length} connected</StatusBadge>
            : <StatusBadge state="offline">Not connected</StatusBadge>}
        </div>
        <GoogleCalendarSettings
          onStatusChange={setGoogleStatus}
          refreshKey={refreshKey}
          token={token}
          user={user}
        />
        <div className="connection-actions">
          <button className="secondary-button" onClick={() => onNavigate('scheduling')} type="button"><CalendarSync size={16} />Open Scheduling</button>
        </div>
      </section>

      <StatusToast error={error} success={success} onDismiss={() => { setError(null); setSuccess(null); }} />
    </div>
  );
}
