import { useEffect, useMemo, useState } from 'react';
import {
  archiveServerRecord,
  createServerRecord,
  getServerRecords,
  updateServerRecord,
} from '../api/serverRecords.js';

const recordTypes = ['server_note', 'incident_log', 'container_record', 'port_record'];
const statuses = ['active', 'planned', 'watching', 'resolved', 'inactive'];

const emptyForm = {
  record_type: 'server_note',
  name: '',
  status: 'active',
  host: '',
  port: '',
  service: '',
  environment: '',
  occurred_at: '',
  notes: '',
  tags: '',
};

function label(value) {
  return value.replaceAll('_', ' ');
}

function formatDate(value) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function ServerManager({ token, onServerRecordsChanged }) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const counts = useMemo(() => records.reduce((summary, record) => {
    summary[record.record_type] = (summary[record.record_type] || 0) + 1;
    return summary;
  }, {}), [records]);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getServerRecords(token);
      setRecords(data.records);
      onServerRecordsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [token]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

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
      const payload = {
        ...form,
        port: form.port || null,
        occurred_at: form.occurred_at || null,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (editingId) {
        await updateServerRecord(token, editingId, payload);
        setStatusMessage('Server record updated.');
      } else {
        await createServerRecord(token, payload);
        setStatusMessage('Server record saved.');
      }

      resetForm();
      await loadRecords();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record._id);
    setForm({
      record_type: record.record_type || 'server_note',
      name: record.name || '',
      status: record.status || 'active',
      host: record.host || '',
      port: record.port ? String(record.port) : '',
      service: record.service || '',
      environment: record.environment || '',
      occurred_at: record.occurred_at ? record.occurred_at.slice(0, 16) : '',
      notes: record.notes || '',
      tags: (record.tags || []).join(', '),
    });
    setError(null);
    setStatusMessage(null);
  };

  const handleArchive = async (record) => {
    setError(null);
    setStatusMessage(null);

    try {
      await archiveServerRecord(token, record._id);
      if (editingId === record._id) resetForm();
      setStatusMessage('Server record archived.');
      await loadRecords();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="server-manager-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Week 12 MVP</p>
          <h2>Server Manager</h2>
        </div>
        <span className="status-pill">{records.length} manual records</span>
      </div>

      <p className="module-description">
        Document infrastructure manually: server notes, incidents, containers, and ports. This page does not run commands or control containers.
      </p>

      <div className="metric-grid">
        {recordTypes.map((type) => (
          <div className="metric-card" key={type}>
            <span>{label(type)}</span>
            <strong>{counts[type] || 0}</strong>
          </div>
        ))}
      </div>

      <div className="utility-layout">
        <form className="panel utility-form" onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Record' : 'Add Record'}</h3>
              <p className="muted">Manual documentation only.</p>
            </div>
            {editingId && (
              <button className="secondary-button" onClick={resetForm} type="button">
                Cancel edit
              </button>
            )}
          </div>

          <div className="form-grid two">
            <label>
              Type
              <select value={form.record_type} onChange={(event) => updateForm('record_type', event.target.value)}>
                {recordTypes.map((type) => (
                  <option key={type} value={type}>{label(type)}</option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Name
            <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Acer server nginx" required />
          </label>

          <div className="form-grid two">
            <label>
              Host
              <input value={form.host} onChange={(event) => updateForm('host', event.target.value)} placeholder="192.168.1.10 or domain" />
            </label>
            <label>
              Port
              <input type="number" min="1" max="65535" value={form.port} onChange={(event) => updateForm('port', event.target.value)} placeholder="5173" />
            </label>
            <label>
              Service
              <input value={form.service} onChange={(event) => updateForm('service', event.target.value)} placeholder="nginx, mongo, app" />
            </label>
            <label>
              Environment
              <input value={form.environment} onChange={(event) => updateForm('environment', event.target.value)} placeholder="home lab, prod, local" />
            </label>
          </div>

          <label>
            Incident time
            <input type="datetime-local" value={form.occurred_at} onChange={(event) => updateForm('occurred_at', event.target.value)} />
          </label>

          <label>
            Notes
            <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Configuration, incident details, next action..." rows={5} />
          </label>

          <label>
            Tags
            <input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="docker, nginx, home-lab" />
          </label>

          {error && <div className="alert-error">{error}</div>}
          {statusMessage && <div className="alert-success">{statusMessage}</div>}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving...' : editingId ? 'Update record' : 'Save record'}
          </button>
        </form>

        <div className="utility-list">
          <div className="panel">
            <h3>Manual Records</h3>
            {loading ? (
              <p className="muted">Loading server records...</p>
            ) : records.length === 0 ? (
              <p className="muted">No server records yet.</p>
            ) : (
              <div className="utility-stack">
                {records.map((record) => (
                  <article className="utility-card" key={record._id}>
                    <div className="entry-card-header">
                      <div>
                        <span className="entry-category">{label(record.record_type)}</span>
                        <h4>{record.name}</h4>
                      </div>
                      <span className="status-pill">{record.status}</span>
                    </div>
                    <div className="task-detail-row">
                      {record.host && <span>Host: {record.host}</span>}
                      {record.port && <span>Port: {record.port}</span>}
                      {record.service && <span>Service: {record.service}</span>}
                      {record.occurred_at && <span>When: {formatDate(record.occurred_at)}</span>}
                    </div>
                    {record.notes && <p>{record.notes}</p>}
                    {record.tags?.length > 0 && (
                      <div className="tag-row">
                        {record.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    )}
                    <div className="entry-actions">
                      <button className="secondary-button" onClick={() => handleEdit(record)} type="button">Edit</button>
                      <button className="secondary-button danger-button" onClick={() => handleArchive(record)} type="button">Archive</button>
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
