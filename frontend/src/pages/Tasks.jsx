import { useEffect, useMemo, useState } from 'react';
import { getProjects } from '../api/projects.js';
import { createTask, getTasks, markTaskDone, updateTask } from '../api/tasks.js';
import { dateInputToUtcIso, formatLocalDate, toUtcDateInput } from '../utils/dateTime.js';

const statuses = ['backlog', 'todo', 'doing', 'blocked', 'done', 'cancelled'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const categories = ['Personal', 'Work', 'Coding', 'Server', 'Health', 'Money', 'Project', 'Errand'];

const emptyForm = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  category: 'Personal',
  due_date: '',
  related_project_id: '',
  tags: '',
};

function taskLabel(value) {
  return value.replace('_', ' ');
}

export default function Tasks({ token, onTasksChanged }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const openCount = useMemo(
    () => tasks.filter((task) => !['done', 'cancelled'].includes(task.status)).length,
    [tasks],
  );

  const loadTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTasks(token);
      setTasks(data.tasks);
      onTasksChanged?.();
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
    loadTasks();
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
    setStatusMessage(null);

    try {
      const payload = {
        ...form,
        due_date: dateInputToUtcIso(form.due_date),
        related_project_id: form.related_project_id || null,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (editingId) {
        await updateTask(token, editingId, payload);
        setStatusMessage('Task updated.');
      } else {
        await createTask(token, payload);
        setStatusMessage('Task saved.');
      }

      resetForm();
      await loadTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (task) => {
    setEditingId(task._id);
    setForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      category: task.category || 'Personal',
      due_date: toUtcDateInput(task.due_date),
      related_project_id: typeof task.related_project_id === 'object'
        ? task.related_project_id?._id || ''
        : task.related_project_id || '',
      tags: (task.tags || []).join(', '),
    });
    setError(null);
    setStatusMessage(null);
  };

  const handleDone = async (task) => {
    setError(null);
    setStatusMessage(null);

    try {
      await markTaskDone(token, task._id);
      if (editingId === task._id) resetForm();
      setStatusMessage('Task marked done.');
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="tasks-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Work queue</p>
          <h2>Tasks</h2>
        </div>
        <span className="status-pill">{openCount} open tasks</span>
      </div>

      <p className="module-description">
        Track personal, project, server, finance, and work items. Recurring tasks, dependencies, and outside integrations come later.
      </p>

      <div className="task-layout">
        <form className="panel task-form" onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Task' : 'Add Task'}</h3>
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
              placeholder="Reserve Acer server IP"
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              placeholder="Optional task notes..."
              rows={5}
            />
          </label>

          <div className="form-grid two">
            <label>
              Status
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {statuses.map((status) => (
                  <option key={status} value={status}>{taskLabel(status)}</option>
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
              Category
              <select value={form.category} onChange={(event) => updateForm('category', event.target.value)}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label>
              Due date
              <input
                type="date"
                value={form.due_date}
                onChange={(event) => updateForm('due_date', event.target.value)}
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

          <label>
            Tags
            <input
              value={form.tags}
              onChange={(event) => updateForm('tags', event.target.value)}
              placeholder="server, network, urgent"
            />
          </label>

          {error && <div className="alert-error">{error}</div>}
          {statusMessage && <div className="alert-success">{statusMessage}</div>}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving...' : editingId ? 'Update task' : 'Save task'}
          </button>
        </form>

        <div className="task-list">
          <div className="panel">
            <h3>Open Tasks</h3>
            {loading ? (
              <p className="muted">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="muted">No open tasks yet.</p>
            ) : (
              <div className="task-stack">
                {tasks.map((task) => (
                  <article className={`task-card priority-${task.priority}`} key={task._id}>
                    <div className="task-card-header">
                      <div>
                        <span className="task-meta">{task.category} / {taskLabel(task.status)}</span>
                        <h4>{task.title}</h4>
                      </div>
                      <span className={`priority-pill ${task.priority}`}>{task.priority}</span>
                    </div>

                    {task.description && <p>{task.description}</p>}

                    <div className="task-detail-row">
                      <span>Due: {formatLocalDate(task.due_date, 'No due date')}</span>
                      {task.related_project_id?.name && (
                        <span>Project: {task.related_project_id.name}</span>
                      )}
                    </div>

                    {task.tags?.length > 0 && (
                      <div className="tag-row">
                        {task.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="entry-actions">
                      <button className="secondary-button" onClick={() => handleEdit(task)} type="button">
                        Edit
                      </button>
                      <button className="secondary-button" onClick={() => handleDone(task)} type="button">
                        Mark done
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
