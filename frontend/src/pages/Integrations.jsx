import { useEffect, useState } from 'react';
import {
  archiveIntegrationRecord,
  createIntegrationRecord,
  getIntegrationRecords,
  updateIntegrationRecord,
} from '../api/integrations.js';

const statuses = ['planned', 'researching', 'ready', 'active', 'paused', 'blocked'];

const emptyForm = {
  provider: '',
  purpose: '',
  status: 'planned',
  auth_type: '',
  owner: '',
  notes: '',
  tags: '',
};

export default function Integrations({ token, onIntegrationsChanged }) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getIntegrationRecords(token);
      setRecords(data.records);
      onIntegrationsChanged?.();
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
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (editingId) {
        await updateIntegrationRecord(token, editingId, payload);
        setStatusMessage('Integration record updated.');
      } else {
        await createIntegrationRecord(token, payload);
        setStatusMessage('Integration record saved.');
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
      provider: record.provider || '',
      purpose: record.purpose || '',
      status: record.status || 'planned',
      auth_type: record.auth_type || '',
      owner: record.owner || '',
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
      await archiveIntegrationRecord(token, record._id);
      if (editingId === record._id) resetForm();
      setStatusMessage('Integration record archived.');
      await loadRecords();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="integrations-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Week 12 MVP</p>
          <h2>Integrations</h2>
        </div>
        <span className="status-pill">{records.length} planned records</span>
      </div>

      <p className="module-description">
        Track future integration plans and setup notes. This page does not authenticate providers or trigger external webhooks.
      </p>

      <div className="utility-layout">
        <form className="panel utility-form" onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Integration' : 'Add Integration'}</h3>
              <p className="muted">Planning records only.</p>
            </div>
            {editingId && (
              <button className="secondary-button" onClick={resetForm} type="button">
                Cancel edit
              </button>
            )}
          </div>

          <label>
            Provider
            <input value={form.provider} onChange={(event) => updateForm('provider', event.target.value)} placeholder="GitHub, Google Calendar, n8n" required />
          </label>

          <label>
            Purpose
            <input value={form.purpose} onChange={(event) => updateForm('purpose', event.target.value)} placeholder="Sync calendar events" required />
          </label>

          <div className="form-grid two">
            <label>
              Status
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Auth type
              <input value={form.auth_type} onChange={(event) => updateForm('auth_type', event.target.value)} placeholder="OAuth, token, webhook" />
            </label>
          </div>

          <label>
            Owner
            <input value={form.owner} onChange={(event) => updateForm('owner', event.target.value)} placeholder="Personal, work, server" />
          </label>

          <label>
            Notes
            <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Requirements, risks, setup plan..." rows={6} />
          </label>

          <label>
            Tags
            <input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="calendar, automation, future" />
          </label>

          {error && <div className="alert-error">{error}</div>}
          {statusMessage && <div className="alert-success">{statusMessage}</div>}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving...' : editingId ? 'Update integration' : 'Save integration'}
          </button>
        </form>

        <div className="utility-list">
          <div className="panel">
            <h3>Integration Records</h3>
            {loading ? (
              <p className="muted">Loading integrations...</p>
            ) : records.length === 0 ? (
              <p className="muted">No integration records yet.</p>
            ) : (
              <div className="utility-stack">
                {records.map((record) => (
                  <article className="utility-card" key={record._id}>
                    <div className="entry-card-header">
                      <div>
                        <span className="entry-category">{record.provider}</span>
                        <h4>{record.purpose}</h4>
                      </div>
                      <span className="status-pill">{record.status}</span>
                    </div>
                    <div className="task-detail-row">
                      {record.auth_type && <span>Auth: {record.auth_type}</span>}
                      {record.owner && <span>Owner: {record.owner}</span>}
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
