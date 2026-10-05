import { useEffect, useState } from 'react';
import {
  archiveKnowledgePage,
  createKnowledgePage,
  getKnowledgePages,
  updateKnowledgePage,
} from '../api/knowledge.js';
import { getProjects } from '../api/projects.js';
import { formatLocalDateTime } from '../utils/dateTime.js';
import { hasValidationErrors, requiredText } from '../utils/formValidation.js';

const emptyForm = {
  title: '',
  content: '',
  related_project_id: '',
  tags: '',
};

export default function KnowledgeBase({ token, refreshKey, onKnowledgeChanged }) {
  const [pages, setPages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState(null);

  const loadPages = async (searchTerm = search) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getKnowledgePages(token, searchTerm);
      setPages(data.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([getKnowledgePages(token, ''), getProjects(token)])
      .then(([pageData, projectData]) => {
        if (cancelled) return;
        setPages(pageData.pages);
        setProjects(projectData.projects);
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
    setFieldErrors({});
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadPages(search);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const nextFieldErrors = {
      title: requiredText(form.title, 'Page title'),
      content: requiredText(form.content, 'Page content'),
    };

    if (hasValidationErrors(nextFieldErrors)) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        related_project_id: form.related_project_id || null,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (editingId) {
        await updateKnowledgePage(token, editingId, payload);
        setStatus('Knowledge page updated.');
      } else {
        await createKnowledgePage(token, payload);
        setStatus('Knowledge page saved.');
      }

      resetForm();
      await loadPages(search);
      onKnowledgeChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (page) => {
    setEditingId(page._id);
    setForm({
      title: page.title || '',
      content: page.content || '',
      related_project_id: typeof page.related_project_id === 'object'
        ? page.related_project_id?._id || ''
        : page.related_project_id || '',
      tags: (page.tags || []).join(', '),
    });
    setError(null);
    setStatus(null);
  };

  const handleArchive = async (page) => {
    setError(null);
    setStatus(null);

    try {
      await archiveKnowledgePage(token, page._id);
      if (editingId === page._id) resetForm();
      setStatus('Knowledge page archived.');
      await loadPages(search);
      onKnowledgeChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="knowledge-base-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Personal documentation</p>
          <h2>Knowledge Base</h2>
        </div>
        <span className="status-pill">{pages.length} visible pages</span>
      </div>

      <p className="module-description">
        Store reusable notes, guides, commands, fixes, and reference material. This MVP keeps editing simple and searchable without rich text.
      </p>

      <div className="project-layout">
        <form className="panel utility-form" noValidate onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Page' : 'Add Page'}</h3>
              <p className="muted">Plain text for now. Use tags separated by commas.</p>
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
              className={fieldErrors.title ? 'field-invalid' : ''}
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              placeholder="Docker compose recovery notes"
            />
            {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
          </label>

          <label>
            Content
            <textarea
              className={fieldErrors.content ? 'field-invalid' : ''}
              value={form.content}
              onChange={(event) => updateForm('content', event.target.value)}
              placeholder="Write the guide, command list, or reusable note here..."
              rows={10}
            />
            {fieldErrors.content && <span className="field-error">{fieldErrors.content}</span>}
          </label>

          <div className="form-grid two">
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

            <label>
              Tags
              <input
                value={form.tags}
                onChange={(event) => updateForm('tags', event.target.value)}
                placeholder="docker, nginx, recovery"
              />
            </label>
          </div>

          {error && <div className="alert-error">{error}</div>}
          {status && <div className="alert-success">{status}</div>}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving...' : editingId ? 'Update page' : 'Save page'}
          </button>
        </form>

        <div className="utility-list">
          <div className="panel">
            <form className="search-row" onSubmit={handleSearch}>
              <label>
                Search Knowledge Base
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, content, or tags"
                />
              </label>
              <button className="secondary-button" type="submit">Search</button>
              {search && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setSearch('');
                    loadPages('');
                  }}
                  type="button"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          <div className="panel">
            <h3>Saved Pages</h3>
            {loading ? (
              <p className="muted">Loading knowledge pages...</p>
            ) : pages.length === 0 ? (
              <p className="muted">No knowledge pages found.</p>
            ) : (
              <div className="utility-stack">
                {pages.map((page) => (
                  <article className="utility-card" key={page._id}>
                    <div className="entry-card-header">
                      <div>
                        <span className="entry-category">Knowledge</span>
                        <h4>{page.title}</h4>
                      </div>
                      <span className="entry-date">{formatLocalDateTime(page.updatedAt || page.createdAt)}</span>
                    </div>

                    <p>{page.content}</p>

                    {page.related_project_id?.name && (
                      <div className="task-detail-row">
                        <span>Project: {page.related_project_id.name}</span>
                      </div>
                    )}

                    {page.tags?.length > 0 && (
                      <div className="tag-row">
                        {page.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="entry-actions">
                      <button className="secondary-button" onClick={() => handleEdit(page)} type="button">
                        Edit
                      </button>
                      <button className="secondary-button danger-button" onClick={() => handleArchive(page)} type="button">
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
