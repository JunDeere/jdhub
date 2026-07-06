import { useEffect, useMemo, useState } from 'react';
import { archiveProject, createProject, getProjects, updateProject } from '../api/projects.js';

const statuses = ['backlog', 'active', 'paused', 'blocked', 'done', 'archived'];
const priorities = ['low', 'medium', 'high'];

const emptyForm = {
  name: '',
  description: '',
  status: 'active',
  priority: 'medium',
  notes: '',
  start_date: '',
  target_date: '',
  tags: '',
};

function formatDate(value) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function label(value) {
  return value.replace('_', ' ');
}

export default function Projects({ token, onProjectsChanged }) {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const activeCount = useMemo(
    () => projects.filter((project) => !['done', 'archived'].includes(project.status)).length,
    [projects],
  );

  const loadProjects = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getProjects(token);
      setProjects(data.projects);
      onProjectsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
        start_date: form.start_date || null,
        target_date: form.target_date || null,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (editingId) {
        await updateProject(token, editingId, payload);
        setStatus('Project updated.');
      } else {
        await createProject(token, payload);
        setStatus('Project saved.');
      }

      resetForm();
      await loadProjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (project) => {
    setEditingId(project._id);
    setForm({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'active',
      priority: project.priority || 'medium',
      notes: project.notes || '',
      start_date: project.start_date ? project.start_date.slice(0, 10) : '',
      target_date: project.target_date ? project.target_date.slice(0, 10) : '',
      tags: (project.tags || []).join(', '),
    });
    setError(null);
    setStatus(null);
  };

  const handleArchive = async (project) => {
    setError(null);
    setStatus(null);

    try {
      await archiveProject(token, project._id);
      if (editingId === project._id) resetForm();
      setStatus('Project archived.');
      await loadProjects();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="projects-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Week 8 MVP</p>
          <h2>Projects</h2>
        </div>
        <span className="status-pill">{activeCount} active projects</span>
      </div>

      <p className="module-description">
        Track builds, maintenance work, paused ideas, and active initiatives. Tasks and Life Log entries can now be linked back to projects.
      </p>

      <div className="project-layout">
        <form className="panel utility-form" onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Project' : 'Add Project'}</h3>
              <p className="muted">Use tags separated by commas.</p>
            </div>
            {editingId && (
              <button className="secondary-button" onClick={resetForm} type="button">
                Cancel edit
              </button>
            )}
          </div>

          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
              placeholder="JDHub"
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              placeholder="What this project is for..."
              rows={4}
            />
          </label>

          <div className="form-grid two">
            <label>
              Status
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {statuses.map((projectStatus) => (
                  <option key={projectStatus} value={projectStatus}>{label(projectStatus)}</option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </label>

            <label>
              Start date
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => updateForm('start_date', event.target.value)}
              />
            </label>

            <label>
              Target date
              <input
                type="date"
                value={form.target_date}
                onChange={(event) => updateForm('target_date', event.target.value)}
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
              placeholder="Milestones, risks, next actions..."
              rows={5}
            />
          </label>

          <label>
            Tags
            <input
              value={form.tags}
              onChange={(event) => updateForm('tags', event.target.value)}
              placeholder="app, docker, personal-os"
            />
          </label>

          {error && <div className="alert-error">{error}</div>}
          {status && <div className="alert-success">{status}</div>}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving...' : editingId ? 'Update project' : 'Save project'}
          </button>
        </form>

        <div className="utility-list">
          <div className="panel">
            <h3>Project List</h3>
            {loading ? (
              <p className="muted">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="muted">No projects yet.</p>
            ) : (
              <div className="utility-stack">
                {projects.map((project) => (
                  <article className="utility-card" key={project._id}>
                    <div className="task-card-header">
                      <div>
                        <span className="task-meta">{label(project.status)}</span>
                        <h4>{project.name}</h4>
                      </div>
                      <span className={`priority-pill ${project.priority}`}>{project.priority}</span>
                    </div>

                    {project.description && <p>{project.description}</p>}

                    <div className="task-detail-row">
                      <span>Start: {formatDate(project.start_date)}</span>
                      <span>Target: {formatDate(project.target_date)}</span>
                    </div>

                    <div className="task-detail-row">
                      <span>{project.task_count || 0} linked tasks</span>
                      <span>{project.entry_count || 0} linked logs</span>
                    </div>

                    {project.notes && <p>{project.notes}</p>}

                    {project.tags?.length > 0 && (
                      <div className="tag-row">
                        {project.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="entry-actions">
                      <button className="secondary-button" onClick={() => handleEdit(project)} type="button">
                        Edit
                      </button>
                      <button className="secondary-button danger-button" onClick={() => handleArchive(project)} type="button">
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
