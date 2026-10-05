import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FolderKanban,
  Plus,
  Search,
  StickyNote,
  X,
} from 'lucide-react';
import { archiveProject, createProject, getProjects, updateProject } from '../api/projects.js';
import { dateInputToUtcIso, formatLocalDate, toUtcDateInput } from '../utils/dateTime.js';
import { dateOrder, hasValidationErrors, requiredText } from '../utils/formValidation.js';

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

function label(value) {
  return value.replaceAll('_', ' ');
}

export default function Projects({ token, refreshKey, onProjectsChanged }) {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState(null);

  const projectSummary = useMemo(() => ({
    active: projects.filter((project) => !['done', 'archived'].includes(project.status)).length,
    attention: projects.filter((project) => ['blocked', 'paused'].includes(project.status)).length,
    completed: projects.filter((project) => project.status === 'done').length,
    linkedItems: projects.reduce(
      (total, project) => total + (project.task_count || 0) + (project.entry_count || 0),
      0,
    ),
  }), [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesQuery = !normalizedQuery || [
        project.name,
        project.description,
        project.notes,
        ...(project.tags || []),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));

      return matchesStatus && matchesQuery;
    });
  }, [projects, query, statusFilter]);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getProjects(token);
      setProjects(data.projects);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getProjects(token)
      .then((data) => {
        if (!cancelled) setProjects(data.projects);
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

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setEditorOpen(false);
    setFieldErrors({});
  };

  const openNewProject = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFieldErrors({});
    setError(null);
    setStatus(null);
    setEditorOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const nextFieldErrors = {
      name: requiredText(form.name, 'Project name'),
      target_date: dateOrder(form.start_date, form.target_date, 'Target date'),
    };

    if (hasValidationErrors(nextFieldErrors)) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        start_date: dateInputToUtcIso(form.start_date),
        target_date: dateInputToUtcIso(form.target_date),
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (editingId) {
        await updateProject(token, editingId, payload);
        setStatus('Project updated.');
      } else {
        await createProject(token, payload);
        setStatus('Project created.');
      }

      resetForm();
      await loadProjects();
      onProjectsChanged?.();
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
      start_date: toUtcDateInput(project.start_date),
      target_date: toUtcDateInput(project.target_date),
      tags: (project.tags || []).join(', '),
    });
    setEditorOpen(true);
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
      onProjectsChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="projects-page">
      <div className="project-page-header">
        <div>
          <p className="eyebrow">Build tracking</p>
          <p className="module-description">
            Organize active work, long-term builds, and paused ideas in one focused workspace.
          </p>
        </div>
        <button className="primary-button project-create-button" onClick={openNewProject} type="button">
          <Plus size={17} />
          New project
        </button>
      </div>

      <div className="project-overview-grid" aria-label="Project overview">
        <article className="project-overview-card">
          <span className="project-overview-icon active"><FolderKanban size={18} /></span>
          <div><strong>{projectSummary.active}</strong><span>Open projects</span></div>
        </article>
        <article className="project-overview-card">
          <span className="project-overview-icon attention"><CircleAlert size={18} /></span>
          <div><strong>{projectSummary.attention}</strong><span>Need attention</span></div>
        </article>
        <article className="project-overview-card">
          <span className="project-overview-icon complete"><CheckCircle2 size={18} /></span>
          <div><strong>{projectSummary.completed}</strong><span>Completed</span></div>
        </article>
        <article className="project-overview-card">
          <span className="project-overview-icon linked"><ClipboardList size={18} /></span>
          <div><strong>{projectSummary.linkedItems}</strong><span>Linked items</span></div>
        </article>
      </div>

      {status && <div className="alert-success">{status}</div>}
      {error && !editorOpen && <div className="alert-error">{error}</div>}

      <div className={`project-workspace${editorOpen ? ' is-editing' : ''}`}>
        {editorOpen && (
          <form className="panel utility-form project-editor-panel" noValidate onSubmit={handleSubmit}>
            <div className="project-editor-heading">
              <div>
                <p className="eyebrow">{editingId ? 'Project details' : 'New workspace'}</p>
                <h3>{editingId ? 'Edit project' : 'Create a project'}</h3>
                <p className="muted">Keep the overview concise; detailed context can live in notes.</p>
              </div>
              <button className="icon-button" aria-label="Close project editor" onClick={resetForm} type="button">
                <X size={18} />
              </button>
            </div>

            <label>
              Project name
              <input
                className={fieldErrors.name ? 'field-invalid' : ''}
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder="e.g. JDHub mobile companion"
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </label>

            <label>
              Short description
              <textarea
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                placeholder="What are you building and why?"
                rows={3}
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
                  className={fieldErrors.target_date ? 'field-invalid' : ''}
                  type="date"
                  value={form.target_date}
                  onChange={(event) => updateForm('target_date', event.target.value)}
                />
                {fieldErrors.target_date && <span className="field-error">{fieldErrors.target_date}</span>}
              </label>
            </div>

            <label>
              Project notes
              <textarea
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
                placeholder="Milestones, risks, decisions, or the next action..."
                rows={4}
              />
            </label>

            <label>
              Tags
              <input
                value={form.tags}
                onChange={(event) => updateForm('tags', event.target.value)}
                placeholder="app, infrastructure, personal"
              />
              <span className="form-hint">Separate tags with commas.</span>
            </label>

            {error && <div className="alert-error">{error}</div>}

            <div className="project-editor-actions">
              <button className="secondary-button" onClick={resetForm} type="button">Cancel</button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create project'}
              </button>
            </div>
          </form>
        )}

        <div className="project-catalog">
          <div className="project-toolbar">
            <div>
              <h3>All projects</h3>
              <p className="muted">{filteredProjects.length} of {projects.length} shown</p>
            </div>
            <div className="project-toolbar-controls">
              <label className="project-search">
                <Search size={16} />
                <input
                  aria-label="Search projects"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects"
                />
              </label>
              <select
                aria-label="Filter projects by status"
                className="project-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.filter((projectStatus) => projectStatus !== 'archived').map((projectStatus) => (
                  <option key={projectStatus} value={projectStatus}>{label(projectStatus)}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="panel project-empty-state"><p className="muted">Loading projects...</p></div>
          ) : filteredProjects.length === 0 ? (
            <div className="panel project-empty-state">
              <span><FolderKanban size={22} /></span>
              <h3>{projects.length === 0 ? 'Create your first project' : 'No matching projects'}</h3>
              <p className="muted">
                {projects.length === 0
                  ? 'Give ongoing work a home, then link tasks and notes as the project grows.'
                  : 'Try another search term or status filter.'}
              </p>
              {projects.length === 0 && (
                <button className="primary-button" onClick={openNewProject} type="button">
                  <Plus size={17} /> New project
                </button>
              )}
            </div>
          ) : (
            <div className="project-card-grid">
              {filteredProjects.map((project) => (
                <article className={`project-card status-${project.status}`} key={project._id}>
                  <div className="project-card-heading">
                    <div>
                      <span className={`project-status-badge ${project.status}`}>{label(project.status)}</span>
                      <h4>{project.name}</h4>
                    </div>
                    <span className={`priority-pill ${project.priority}`}>{project.priority}</span>
                  </div>

                  <p className={`project-card-description${project.description ? '' : ' is-empty'}`}>
                    {project.description || 'No description added yet.'}
                  </p>

                  <div className="project-card-facts">
                    <span><CalendarDays size={15} />{formatLocalDate(project.target_date, 'No target date')}</span>
                    <span><ClipboardList size={15} />{project.task_count || 0} tasks</span>
                    <span><StickyNote size={15} />{project.entry_count || 0} notes</span>
                  </div>

                  {project.tags?.length > 0 && (
                    <div className="tag-row project-tags">
                      {project.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                      {project.tags.length > 4 && <span>+{project.tags.length - 4}</span>}
                    </div>
                  )}

                  {project.notes && (
                    <details className="project-notes">
                      <summary>Project notes</summary>
                      <p>{project.notes}</p>
                    </details>
                  )}

                  <div className="project-card-footer">
                    <span>Started {formatLocalDate(project.start_date, 'Not set')}</span>
                    <div className="entry-actions">
                      <button className="secondary-button compact-button" onClick={() => handleEdit(project)} type="button">
                        Edit
                      </button>
                      <button
                        className="icon-button danger-button"
                        aria-label={`Archive ${project.name}`}
                        title="Archive project"
                        onClick={() => handleArchive(project)}
                        type="button"
                      >
                        <Archive size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
