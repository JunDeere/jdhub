import { useEffect, useState } from 'react';
import { completeReminder, createReminder, getReminders, updateReminder } from '../api/reminders.js';

const emptyForm = {
  title: '',
  description: '',
  remind_at: '',
  status: 'pending',
  tags: '',
};

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function Reminders({ token, onRemindersChanged }) {
  const [reminders, setReminders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const loadReminders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReminders(token);
      setReminders(data.reminders);
      onRemindersChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [token]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const payload = { ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) };
      if (editingId) {
        await updateReminder(token, editingId, payload);
        setStatusMessage('Reminder updated.');
      } else {
        await createReminder(token, payload);
        setStatusMessage('Reminder saved.');
      }
      resetForm();
      await loadReminders();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reminder) => {
    setEditingId(reminder._id);
    setForm({
      title: reminder.title || '',
      description: reminder.description || '',
      remind_at: toLocalInput(reminder.remind_at),
      status: reminder.status || 'pending',
      tags: (reminder.tags || []).join(', '),
    });
  };

  const handleComplete = async (reminder) => {
    setError(null);
    setStatusMessage(null);
    try {
      await completeReminder(token, reminder._id);
      if (editingId === reminder._id) resetForm();
      setStatusMessage('Reminder completed.');
      await loadReminders();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="reminders-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Week 7 MVP</p>
          <h2>Reminders</h2>
        </div>
        <span className="status-pill">{reminders.length} active reminders</span>
      </div>

      <p className="module-description">Internal reminders only. Notifications, recurrence, email, Discord, and calendar sync come later.</p>

      <div className="utility-layout">
        <form className="panel utility-form" onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Reminder' : 'Add Reminder'}</h3>
              <p className="muted">Set the date and time JDHub should track.</p>
            </div>
            {editingId && <button className="secondary-button" onClick={resetForm} type="button">Cancel edit</button>}
          </div>

          <label>
            Title
            <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={4} />
          </label>
          <div className="form-grid two">
            <label>
              Remind at
              <input type="datetime-local" value={form.remind_at} onChange={(event) => updateForm('remind_at', event.target.value)} required />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {['pending', 'snoozed', 'completed', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <label>
            Tags
            <input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="bill, server, personal" />
          </label>

          {error && <div className="alert-error">{error}</div>}
          {statusMessage && <div className="alert-success">{statusMessage}</div>}
          <button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving...' : editingId ? 'Update reminder' : 'Save reminder'}</button>
        </form>

        <div className="utility-list">
          <div className="panel">
            <h3>Upcoming Reminders</h3>
            {loading ? <p className="muted">Loading reminders...</p> : reminders.length === 0 ? <p className="muted">No active reminders yet.</p> : (
              <div className="utility-stack">
                {reminders.map((reminder) => (
                  <article className="utility-card" key={reminder._id}>
                    <div className="task-card-header">
                      <div>
                        <span className="task-meta">{reminder.status}</span>
                        <h4>{reminder.title}</h4>
                      </div>
                      <span className="entry-date">{formatDate(reminder.remind_at)}</span>
                    </div>
                    {reminder.description && <p>{reminder.description}</p>}
                    {reminder.tags?.length > 0 && <div className="tag-row">{reminder.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                    <div className="entry-actions">
                      <button className="secondary-button" onClick={() => handleEdit(reminder)} type="button">Edit</button>
                      <button className="secondary-button" onClick={() => handleComplete(reminder)} type="button">Complete</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
