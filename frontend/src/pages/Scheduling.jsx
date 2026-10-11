import { CalendarPlus, ChevronLeft, ChevronRight, Cloud, Edit3, Plus, RefreshCw, Trash2, Unplug, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  createScheduleItem,
  deleteScheduleItem,
  getSchedule,
  updateScheduleItem,
} from '../api/schedule.js';
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  importGoogleCalendar,
  pushScheduleToGoogle,
  startGoogleCalendarConnection,
} from '../api/googleCalendar.js';
import StatusToast from '../components/StatusToast.jsx';
import {
  formatLocalDate,
  localDateTimeInputToUtcIso,
  toLocalDateTimeInput,
} from '../utils/dateTime.js';
import { dateOrder, hasValidationErrors, requiredText } from '../utils/formValidation.js';

const emptyForm = {
  title: '',
  description: '',
  start_at: '',
  end_at: '',
  location: '',
  status: 'scheduled',
};

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function monthLabel(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

function timeLabel(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: dateKey(date),
      inMonth: date.getMonth() === month,
    };
  });
}

function formForDate(key) {
  const date = dateFromKey(key);
  date.setHours(9, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(10, 0, 0, 0);

  return {
    ...emptyForm,
    start_at: toLocalDateTimeInput(date.toISOString()),
    end_at: toLocalDateTimeInput(endDate.toISOString()),
  };
}

export default function Scheduling({ token, refreshKey, onScheduleChanged }) {
  const todayKey = dateKey(new Date());
  const [scheduleItems, setScheduleItems] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(dateFromKey(todayKey));
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [googleStatus, setGoogleStatus] = useState({ configured: true, connected: false, accounts: [] });
  const [selectedGoogleAccountId, setSelectedGoogleAccountId] = useState('');
  const [googleBusy, setGoogleBusy] = useState('');

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSchedule(token);
      setScheduleItems(data.scheduleItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleStatus = async () => {
    const data = await getGoogleCalendarStatus(token);
    setGoogleStatus(data);
    setSelectedGoogleAccountId((current) => (
      data.accounts?.some((account) => account.id === current) ? current : data.accounts?.[0]?.id || ''
    ));
    return data;
  };

  useEffect(() => {
    let cancelled = false;

    getSchedule(token)
      .then((data) => {
        if (!cancelled) setScheduleItems(data.scheduleItems);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    let feedbackTimer;
    getGoogleCalendarStatus(token)
      .then((data) => {
        if (!cancelled) {
          setGoogleStatus(data);
          setSelectedGoogleAccountId((current) => (
            data.accounts?.some((account) => account.id === current) ? current : data.accounts?.[0]?.id || ''
          ));
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); });

    const url = new URL(window.location.href);
    const result = url.searchParams.get('google_calendar');
    if (result) {
      const messages = {
        connected: 'Google Calendar connected.',
        denied: 'Google Calendar access was cancelled.',
        failed: 'Google Calendar could not be connected.',
        not_configured: 'Google Calendar is not configured on this server.',
      };
      feedbackTimer = window.setTimeout(() => {
        if (result === 'connected') setStatusMessage(messages[result]);
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

  const connectGoogle = async () => {
    setGoogleBusy('connect');
    setError(null);
    try {
      const data = await startGoogleCalendarConnection(token);
      window.location.assign(data.authorizationUrl);
    } catch (err) {
      setError(err.message);
      setGoogleBusy('');
    }
  };

  const importFromGoogle = async () => {
    if (!selectedGoogleAccountId) return;
    setGoogleBusy('import');
    setError(null);
    setStatusMessage(null);
    try {
      const data = await importGoogleCalendar(token, selectedGoogleAccountId);
      setStatusMessage(`Imported ${data.imported} event${data.imported === 1 ? '' : 's'} from ${data.accountEmail}.`);
      await Promise.all([loadSchedule(), loadGoogleStatus()]);
      onScheduleChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGoogleBusy('');
    }
  };

  const importAllFromGoogle = async () => {
    if (!googleStatus.accounts?.length) return;
    setGoogleBusy('import-all');
    setError(null);
    setStatusMessage(null);
    try {
      let total = 0;
      for (const account of googleStatus.accounts) {
        const data = await importGoogleCalendar(token, account.id);
        total += data.imported;
      }
      setStatusMessage(`Imported ${total} event${total === 1 ? '' : 's'} across ${googleStatus.accounts.length} Google accounts.`);
      await Promise.all([loadSchedule(), loadGoogleStatus()]);
      onScheduleChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGoogleBusy('');
    }
  };

  const pushToGoogle = async () => {
    const selectedAccount = googleStatus.accounts?.find((account) => account.id === selectedGoogleAccountId);
    if (!selectedAccount) return;
    const confirmed = window.confirm(`Create or update your JDHub schedule items in ${selectedAccount.accountEmail}? Google events will not be deleted.`);
    if (!confirmed) return;
    setGoogleBusy('push');
    setError(null);
    setStatusMessage(null);
    try {
      const data = await pushScheduleToGoogle(token, selectedGoogleAccountId);
      setStatusMessage(`${data.accountEmail} updated: ${data.created} created, ${data.updated} updated.`);
      await Promise.all([loadSchedule(), loadGoogleStatus()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setGoogleBusy('');
    }
  };

  const disconnectGoogle = async () => {
    const selectedAccount = googleStatus.accounts?.find((account) => account.id === selectedGoogleAccountId);
    if (!selectedAccount) return;
    if (!window.confirm(`Disconnect ${selectedAccount.accountEmail} from JDHub? Existing events in either calendar will not be deleted.`)) return;
    setGoogleBusy('disconnect');
    setError(null);
    try {
      await disconnectGoogleCalendar(token, selectedGoogleAccountId);
      await loadGoogleStatus();
      setStatusMessage(`${selectedAccount.accountEmail} disconnected.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGoogleBusy('');
    }
  };

  const itemsByDate = useMemo(() => scheduleItems.reduce((groups, item) => {
    const key = dateKey(item.start_at);
    return { ...groups, [key]: [...(groups[key] || []), item] };
  }, {}), [scheduleItems]);

  const selectedItems = itemsByDate[selectedDate] || [];
  const calendarDays = buildCalendarDays(visibleMonth);
  const googleAccounts = googleStatus.accounts || [];
  const selectedGoogleAccount = googleAccounts.find((account) => account.id === selectedGoogleAccountId);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const openCreateModal = (key = selectedDate) => {
    setEditingId(null);
    setForm(formForDate(key));
    setFieldErrors({});
    setStatusMessage(null);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      start_at: toLocalDateTimeInput(item.start_at),
      end_at: toLocalDateTimeInput(item.end_at),
      location: item.location || '',
      status: item.status || 'scheduled',
    });
    setFieldErrors({});
    setStatusMessage(null);
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setDeleting(false);
  };

  const moveMonth = (direction) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    const nextFieldErrors = {
      title: requiredText(form.title, 'Schedule title'),
      start_at: requiredText(form.start_at, 'Start time'),
      end_at: dateOrder(form.start_at, form.end_at, 'End time'),
    };

    if (hasValidationErrors(nextFieldErrors)) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        start_at: localDateTimeInputToUtcIso(form.start_at),
        end_at: localDateTimeInputToUtcIso(form.end_at),
      };

      const result = editingId
        ? await updateScheduleItem(token, editingId, payload)
        : await createScheduleItem(token, payload);

      const savedItem = result.scheduleItem;
      const nextSelectedDate = dateKey(savedItem.start_at);
      setSelectedDate(nextSelectedDate);
      setVisibleMonth(dateFromKey(nextSelectedDate));
      closeModal();
      setStatusMessage(editingId ? 'Schedule item updated.' : 'Schedule item saved.');
      await loadSchedule();
      onScheduleChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    setDeleting(true);
    setError(null);
    setStatusMessage(null);

    try {
      await deleteScheduleItem(token, editingId);
      closeModal();
      setStatusMessage('Schedule item deleted.');
      await loadSchedule();
      onScheduleChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="scheduling-page">
      <div className="panel google-calendar-panel">
        <div className="google-calendar-copy">
          <span className="google-calendar-icon"><Cloud size={18} /></span>
          <div>
            <strong>Google Calendar</strong>
            <p className="muted">
              {googleStatus.connected
                ? `${googleAccounts.length} Google account${googleAccounts.length === 1 ? '' : 's'} connected. Their imported events appear together in JDHub.`
                : googleStatus.configured === false
                  ? 'Server setup is required before an account can be connected.'
                  : 'Connect your account to bring Google events into this calendar.'}
            </p>
            {selectedGoogleAccount?.lastSyncedAt && <small>Last synced {new Date(selectedGoogleAccount.lastSyncedAt).toLocaleString()}</small>}
          </div>
        </div>
        <div className="google-calendar-actions">
          {googleStatus.connected ? (
            <>
              <label className="google-account-picker">
                <span>Google account</span>
                <select value={selectedGoogleAccountId} onChange={(event) => setSelectedGoogleAccountId(event.target.value)}>
                  {googleAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.accountEmail}</option>
                  ))}
                </select>
              </label>
              <button className="secondary-button" disabled={Boolean(googleBusy)} onClick={importFromGoogle} type="button">
                <RefreshCw className={googleBusy === 'import' ? 'spin' : ''} size={16} />
                {googleBusy === 'import' ? 'Importing...' : 'Import selected'}
              </button>
              {googleAccounts.length > 1 && (
                <button className="secondary-button" disabled={Boolean(googleBusy)} onClick={importAllFromGoogle} type="button">
                  <RefreshCw className={googleBusy === 'import-all' ? 'spin' : ''} size={16} />
                  {googleBusy === 'import-all' ? 'Importing all...' : 'Import all'}
                </button>
              )}
              <button className="primary-button" disabled={Boolean(googleBusy)} onClick={pushToGoogle} type="button">
                <Cloud size={16} />
                {googleBusy === 'push' ? 'Syncing...' : 'Push JDHub to Google'}
              </button>
              <button aria-label="Disconnect Google Calendar" className="icon-only-button" disabled={Boolean(googleBusy)} onClick={disconnectGoogle} title="Disconnect Google Calendar" type="button">
                <Unplug size={17} />
              </button>
              <button className="secondary-button" disabled={Boolean(googleBusy)} onClick={connectGoogle} type="button">
                <Plus size={16} />
                Add account
              </button>
            </>
          ) : (
            <button className="primary-button" disabled={googleStatus.configured === false || Boolean(googleBusy)} onClick={connectGoogle} type="button">
              <Cloud size={16} />
              {googleBusy === 'connect' ? 'Opening Google...' : 'Connect Google Calendar'}
            </button>
          )}
        </div>
      </div>
      <div className="calendar-shell">
        <div className="panel calendar-panel">
          <div className="calendar-toolbar">
            <button aria-label="Previous month" className="secondary-button" onClick={() => moveMonth(-1)} type="button">
              <ChevronLeft size={17} />
            </button>
            <div>
              <h3>{monthLabel(visibleMonth)}</h3>
              <span>{loading ? 'Loading calendar...' : `${scheduleItems.length} saved items`}</span>
            </div>
            <button aria-label="Next month" className="secondary-button" onClick={() => moveMonth(1)} type="button">
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayItems = itemsByDate[day.key] || [];
              return (
                <button
                  className={[
                    'calendar-day',
                    day.inMonth ? '' : 'outside-month',
                    day.key === todayKey ? 'today' : '',
                    day.key === selectedDate ? 'selected' : '',
                  ].filter(Boolean).join(' ')}
                  key={day.key}
                  onClick={() => {
                    setSelectedDate(day.key);
                    setStatusMessage(null);
                  }}
                  type="button"
                >
                  <span>{day.date.getDate()}</span>
                  {dayItems.length > 0 && <strong>{dayItems.length}</strong>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel selected-day-panel">
          <div className="control-row">
            <div>
              <h3>{formatLocalDate(dateFromKey(selectedDate), 'Selected day')}</h3>
              <p className="muted">{selectedItems.length ? `${selectedItems.length} schedule item${selectedItems.length === 1 ? '' : 's'}` : 'No items for this day.'}</p>
            </div>
            <button className="primary-button" onClick={() => openCreateModal(selectedDate)} type="button">
              <CalendarPlus size={17} />
              Add
            </button>
          </div>

          {selectedItems.length ? (
            <div className="schedule-agenda">
              {selectedItems.map((item) => (
                <article className="schedule-agenda-item" key={item._id}>
                  <div>
                    <span>{item.all_day ? 'All day' : `${timeLabel(item.start_at)}${item.end_at ? ` - ${timeLabel(item.end_at)}` : ''}`}</span>
                    <strong>{item.title}</strong>
                    {item.external_provider === 'google' && (
                      <small className="google-event-label">
                        Google Calendar{item.google_calendar_links?.length > 1
                          ? ` · ${item.google_calendar_links.length} accounts`
                          : item.external_account_email ? ` · ${item.external_account_email}` : ''}
                      </small>
                    )}
                    {item.location && <small>{item.location}</small>}
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <button className="secondary-button" onClick={() => openEditModal(item)} type="button">
                    <Edit3 size={16} />
                    Edit
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="schedule-empty">
              <CalendarPlus size={24} />
              <p>No schedule items on this day.</p>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation">
          <form aria-labelledby="schedule-modal-title" aria-modal="true" className="modal-card schedule-modal utility-form" noValidate onSubmit={handleSubmit} role="dialog">
            <div className="modal-header">
              <div>
                <p className="eyebrow">{editingId ? 'Edit schedule' : 'Add schedule'}</p>
                <h3 id="schedule-modal-title">{editingId ? 'Edit Schedule Item' : 'New Schedule Item'}</h3>
              </div>
              <button aria-label="Close schedule modal" className="icon-only-button" onClick={closeModal} type="button">
                <X size={18} />
              </button>
            </div>

            <label>
              Title
              <input className={fieldErrors.title ? 'field-invalid' : ''} value={form.title} onChange={(event) => updateForm('title', event.target.value)} />
              {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
            </label>

            <label>
              Description
              <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={4} />
            </label>

            <div className="form-grid two">
              <label>
                Start
                <input className={fieldErrors.start_at ? 'field-invalid' : ''} type="datetime-local" value={form.start_at} onChange={(event) => updateForm('start_at', event.target.value)} />
                {fieldErrors.start_at && <span className="field-error">{fieldErrors.start_at}</span>}
              </label>
              <label>
                End
                <input className={fieldErrors.end_at ? 'field-invalid' : ''} type="datetime-local" value={form.end_at} onChange={(event) => updateForm('end_at', event.target.value)} />
                {fieldErrors.end_at && <span className="field-error">{fieldErrors.end_at}</span>}
              </label>
              <label>
                Location
                <input value={form.location} onChange={(event) => updateForm('location', event.target.value)} />
              </label>
              <label>
                Status
                <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                  {['scheduled', 'done', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>

            {error && <div className="alert-error">{error}</div>}

            <div className="modal-actions">
              {editingId && (
                <button className="danger-button" disabled={deleting || saving} onClick={handleDelete} type="button">
                  <Trash2 size={16} />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <button className="secondary-button" onClick={closeModal} type="button">Cancel</button>
              <button className="primary-button" disabled={saving || deleting} type="submit">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
      <StatusToast error={!modalOpen ? error : null} success={!modalOpen ? statusMessage : null} onDismiss={() => { setError(null); setStatusMessage(null); }} />
    </section>
  );
}
