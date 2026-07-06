import { useEffect, useState } from 'react';
import { createScheduleItem, getSchedule, updateScheduleItem } from '../api/schedule.js';

const emptyForm = {
  title: '',
  description: '',
  start_at: '',
  end_at: '',
  location: '',
  status: 'scheduled',
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

export default function Scheduling({ token, onScheduleChanged }) {
  const [scheduleItems, setScheduleItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSchedule(token);
      setScheduleItems(data.scheduleItems);
      onScheduleChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
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
      if (editingId) {
        await updateScheduleItem(token, editingId, form);
        setStatusMessage('Schedule item updated.');
      } else {
        await createScheduleItem(token, form);
        setStatusMessage('Schedule item saved.');
      }
      resetForm();
      await loadSchedule();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      start_at: toLocalInput(item.start_at),
      end_at: toLocalInput(item.end_at),
      location: item.location || '',
      status: item.status || 'scheduled',
    });
  };

  return (
    <section className="scheduling-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Week 7 MVP</p>
          <h2>Scheduling</h2>
        </div>
        <span className="status-pill">{scheduleItems.length} upcoming items</span>
      </div>

      <p className="module-description">Internal schedule items first. Google Calendar import/export and conflict detection come later.</p>

      <div className="utility-layout">
        <form className="panel utility-form" onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Schedule Item' : 'Add Schedule Item'}</h3>
              <p className="muted">Track planned time blocks and appointments.</p>
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
              Start
              <input type="datetime-local" value={form.start_at} onChange={(event) => updateForm('start_at', event.target.value)} required />
            </label>
            <label>
              End
              <input type="datetime-local" value={form.end_at} onChange={(event) => updateForm('end_at', event.target.value)} />
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
          {statusMessage && <div className="alert-success">{statusMessage}</div>}
          <button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving...' : editingId ? 'Update schedule item' : 'Save schedule item'}</button>
        </form>

        <div className="utility-list">
          <div className="panel">
            <h3>Upcoming Schedule</h3>
            {loading ? <p className="muted">Loading schedule...</p> : scheduleItems.length === 0 ? <p className="muted">No upcoming schedule items yet.</p> : (
              <div className="utility-stack">
                {scheduleItems.map((item) => (
                  <article className="utility-card" key={item._id}>
                    <div className="task-card-header">
                      <div>
                        <span className="task-meta">{item.status}</span>
                        <h4>{item.title}</h4>
                      </div>
                      <span className="entry-date">{formatDate(item.start_at)}</span>
                    </div>
                    {item.description && <p>{item.description}</p>}
                    {item.location && <p>Location: {item.location}</p>}
                    <div className="entry-actions">
                      <button className="secondary-button" onClick={() => handleEdit(item)} type="button">Edit</button>
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
