import { useEffect, useState } from 'react';
import { archiveEntry, createEntry, getEntries, updateEntry } from '../api/entries.js';
import { getProjects } from '../api/projects.js';

const categories = ['Personal', 'Work', 'Coding', 'Server', 'Health', 'Money', 'Idea', 'Incident', 'Learning'];

const emptyForm = {
  title: '',
  content: '',
  category: 'Personal',
  related_project_id: '',
  tags: '',
};

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function LifeLog({ token, onEntriesChanged }) {
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getEntries(token);
      setEntries(data.entries);
      onEntriesChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await getProjects(token);
      setProjects(data.projects);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadEntries();
    loadProjects();
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
    setStatus(null);

    try {
      const payload = {
        ...form,
        related_project_id: form.related_project_id || null,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (editingId) {
        await updateEntry(token, editingId, payload);
        setStatus('Entry updated.');
      } else {
        await createEntry(token, payload);
        setStatus('Entry saved.');
      }

      resetForm();
      await loadEntries();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      title: entry.title || '',
      content: entry.content || '',
      category: entry.category || 'Personal',
      related_project_id: typeof entry.related_project_id === 'object'
        ? entry.related_project_id?._id || ''
        : entry.related_project_id || '',
      tags: (entry.tags || []).join(', '),
    });
    setStatus(null);
    setError(null);
  };

  const handleArchive = async (entry) => {
    setError(null);
    setStatus(null);

    try {
      await archiveEntry(token, entry._id);
      setStatus('Entry archived.');
      if (editingId === entry._id) resetForm();
      await loadEntries();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="life-log-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Week 4 MVP</p>
          <h2>Life Log</h2>
        </div>
        <span className="status-pill">{entries.length} active entries</span>
      </div>

      <p className="module-description">
        Store notes, incidents, technical fixes, ideas, health notes, and learning records. Attachments, AI summaries, and search come later.
      </p>

      <div className="life-log-layout">
        <form className="panel entry-form" onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Entry' : 'Add Entry'}</h3>
              <p className="muted">Use tags separated by commas.</p>
            </div>
            {editingId && (
              <button className="secondary-button" onClick={resetForm} type="button">
                Cancel edit
              </button>
            )}
          </div>

          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              placeholder="Blackout broke Acer server access"
              required
            />
          </label>

          <label>
            Content
            <textarea
              value={form.content}
              onChange={(event) => updateForm('content', event.target.value)}
              placeholder="Write the details here..."
              required
              rows={8}
            />
          </label>

          <div className="form-grid two">
            <label>
              Category
              <select value={form.category} onChange={(event) => updateForm('category', event.target.value)}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label>
              Tags
              <input
                value={form.tags}
                onChange={(event) => updateForm('tags', event.target.value)}
                placeholder="nginx, blackout, docker"
              />
            </label>

            <label>
              Project
              <select
                value={form.related_project_id}
                onChange={(event) => updateForm('related_project_id', event.target.value)}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>{project.name}</option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="alert-error">{error}</div>}
          {status && <div className="alert-success">{status}</div>}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving...' : editingId ? 'Update entry' : 'Save entry'}
          </button>
        </form>

        <div className="entry-list">
          <div className="panel">
            <h3>Recent Entries</h3>
            {loading ? (
              <p className="muted">Loading entries...</p>
            ) : entries.length === 0 ? (
              <p className="muted">No Life Log entries yet.</p>
            ) : (
              <div className="entry-stack">
                {entries.map((entry) => (
                  <article className="entry-card" key={entry._id}>
                    <div className="entry-card-header">
                      <div>
                        <span className="entry-category">{entry.category}</span>
                        <h4>{entry.title}</h4>
                      </div>
                      <span className="entry-date">{formatDate(entry.createdAt)}</span>
                    </div>

                    <p>{entry.content}</p>

                    {entry.related_project_id?.name && (
                      <div className="task-detail-row">
                        <span>Project: {entry.related_project_id.name}</span>
                      </div>
                    )}

                    {entry.tags?.length > 0 && (
                      <div className="tag-row">
                        {entry.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="entry-actions">
                      <button className="secondary-button" onClick={() => handleEdit(entry)} type="button">
                        Edit
                      </button>
                      <button className="secondary-button danger-button" onClick={() => handleArchive(entry)} type="button">
                        Archive
                      </button>
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
