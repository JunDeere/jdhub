import { BellRing, CalendarDays, CircleDollarSign, ClipboardList, Plug, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getNotificationPreferences, updateNotificationPreferences } from '../api/notifications.js';
import StatusToast from './StatusToast.jsx';

const options = [
  { key: 'tasks', label: 'Tasks', detail: 'Due soon and overdue work', icon: ClipboardList },
  { key: 'schedule', label: 'Schedule and reminders', detail: 'Events and reminders within 24 hours', icon: CalendarDays },
  { key: 'finance', label: 'Finance', detail: 'Due money items and cash warnings', icon: CircleDollarSign },
  { key: 'connections', label: 'Connections', detail: 'Google Calendar sync failures', icon: Plug },
  { key: 'system', label: 'System health', detail: 'JDHub service and database warnings', icon: ShieldCheck },
];

export default function NotificationPreferences({ token, onChanged }) {
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getNotificationPreferences(token)
      .then((data) => active && setPreferences(data.preferences))
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [token]);

  const toggle = async (key) => {
    if (!preferences || saving) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSaving(key);
    setError(null);
    try {
      const data = await updateNotificationPreferences(token, { [key]: next[key] });
      setPreferences(data.preferences);
      onChanged?.();
    } catch (requestError) {
      setPreferences(preferences);
      setError(requestError.message);
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="panel notification-preferences">
      <div className="control-row">
        <div>
          <p className="eyebrow">Notification Center</p>
          <h3><BellRing size={19} /> Alert preferences</h3>
          <p className="muted">Choose the signals that appear in the notification bell. Changes save automatically.</p>
        </div>
      </div>

      <div className="notification-preference-grid">
        {options.map(({ key, label, detail, icon: Icon }) => (
          <button
            aria-pressed={Boolean(preferences?.[key])}
            className={`notification-preference ${preferences?.[key] ? 'enabled' : ''}`}
            disabled={!preferences || Boolean(saving)}
            key={key}
            onClick={() => toggle(key)}
            type="button"
          >
            <span className="notification-preference-icon"><Icon size={18} /></span>
            <span><strong>{label}</strong><small>{detail}</small></span>
            <span className="notification-switch" aria-hidden="true"><i /></span>
          </button>
        ))}
      </div>
      <StatusToast error={error} onDismiss={() => setError(null)} />
    </div>
  );
}
