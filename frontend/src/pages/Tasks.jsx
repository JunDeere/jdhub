import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  CircleAlert,
  ClipboardCheck,
  FolderKanban,
  LayoutGrid,
  List,
  ListTodo,
  Pencil,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { getProjects } from '../api/projects.js';
import { createTask, getTasks, markTaskDone, updateTask, updateTaskStatus } from '../api/tasks.js';
import { dateInputToUtcIso, formatLocalDate, toUtcDateInput } from '../utils/dateTime.js';
import { hasValidationErrors, requiredText } from '../utils/formValidation.js';

const statuses = ['backlog', 'todo', 'doing', 'blocked', 'done', 'cancelled'];
const activeStatuses = ['backlog', 'todo', 'doing', 'blocked'];
const boardStatuses = [...activeStatuses, 'done'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const categories = ['Personal', 'Work', 'Coding', 'Server', 'Health', 'Money', 'Project', 'Errand'];
const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

const emptyForm = {
  title: '', description: '', status: 'todo', priority: 'medium', category: 'Personal',
  due_date: '', related_project_id: '', tags: '',
};

function taskLabel(value) {
  return value.replaceAll('_', ' ');
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dueState(task) {
  if (!task.due_date) return 'none';
  const parsed = new Date(task.due_date);
  if (Number.isNaN(parsed.getTime())) return 'none';
  const key = parsed.toISOString().slice(0, 10);
  const today = localDateKey();
  if (key < today) return 'overdue';
  if (key === today) return 'today';
  return 'upcoming';
}

function projectId(task) {
  return typeof task.related_project_id === 'object'
    ? task.related_project_id?._id || ''
    : task.related_project_id || '';
}

function taskProject(task) {
  return typeof task.related_project_id === 'object' ? task.related_project_id?.name || '' : '';
}

export default function Tasks({ token, refreshKey, onTasksChanged }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [view, setView] = useState('open');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [displayMode, setDisplayMode] = useState('board');
  const [sortMode, setSortMode] = useState('due');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [draggingTaskId, setDraggingTaskId] = useState('');
  const [dragOverStatus, setDragOverStatus] = useState('');
  const [movingTaskId, setMovingTaskId] = useState('');

  const summary = useMemo(() => {
    const active = tasks.filter((task) => activeStatuses.includes(task.status));
    const completed = tasks.filter((task) => task.status === 'done');
    const trackedTotal = active.length + completed.length;
    return {
      open: active.length,
      today: active.filter((task) => dueState(task) === 'today').length,
      overdue: active.filter((task) => dueState(task) === 'overdue').length,
      completed: completed.length,
      linked: active.filter((task) => projectId(task)).length,
      independent: active.filter((task) => !projectId(task)).length,
      completionRate: trackedTotal ? Math.round((completed.length / trackedTotal) * 100) : 0,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks
      .filter((task) => {
        const taskIsActive = activeStatuses.includes(task.status);
        const matchesView = view === 'completed'
          ? task.status === 'done'
          : view === 'open' && displayMode === 'board'
            ? boardStatuses.includes(task.status)
            : taskIsActive && (view === 'open' || dueState(task) === view);
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        const relationId = projectId(task);
        const matchesProject = projectFilter === 'all'
          || (projectFilter === 'independent' ? !relationId : relationId === projectFilter);
        const matchesQuery = !normalizedQuery || [
          task.title, task.description, task.category, task.status, task.priority,
          taskProject(task), ...(task.tags || []),
        ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
        return matchesView && matchesStatus && matchesPriority && matchesProject && matchesQuery;
      })
      .sort((a, b) => {
        if (sortMode === 'priority') {
          return priorityOrder[a.priority] - priorityOrder[b.priority]
            || (a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER)
              - (b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER);
        }
        if (sortMode === 'title') return a.title.localeCompare(b.title);
        const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return dueA - dueB || priorityOrder[a.priority] - priorityOrder[b.priority]
          || a.title.localeCompare(b.title);
      });
  }, [displayMode, priorityFilter, projectFilter, query, sortMode, statusFilter, tasks, view]);

  const boardColumns = useMemo(() => {
    const labels = { backlog: 'Backlog', todo: 'To do', doing: 'In progress', blocked: 'Blocked', done: 'Done' };
    return boardStatuses.map((status) => ({
      status,
      label: labels[status],
      tasks: filteredTasks.filter((task) => task.status === status),
    }));
  }, [filteredTasks]);

  const taskGroups = useMemo(() => {
    if (view === 'completed') return filteredTasks.length ? [{ key: 'completed', label: 'Completed', tasks: filteredTasks }] : [];
    if (view === 'today') return filteredTasks.length ? [{ key: 'today', label: 'Due today', tasks: filteredTasks }] : [];
    if (view === 'overdue') return filteredTasks.length ? [{ key: 'overdue', label: 'Overdue', tasks: filteredTasks }] : [];
    const labels = { overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', none: 'No due date' };
    return ['overdue', 'today', 'upcoming', 'none']
      .map((key) => ({ key, label: labels[key], tasks: filteredTasks.filter((task) => dueState(task) === key) }))
      .filter((group) => group.tasks.length);
  }, [filteredTasks, view]);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTasks(token, { includeDone: true });
      setTasks(data.tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTasks(token, { includeDone: true }), getProjects(token)])
      .then(([taskData, projectData]) => {
        if (cancelled) return;
        setTasks(taskData.tasks);
        setProjects(projectData.projects);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, refreshKey]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const closeEditor = () => {
    setForm(emptyForm);
    setEditingId(null);
    setEditorOpen(false);
    setFieldErrors({});
  };

  const openNewTask = () => {
    closeEditor();
    setError(null);
    setStatusMessage(null);
    setEditorOpen(true);
  };

  const chooseView = (nextView) => {
    setView(nextView);
    setStatusFilter('all');
    if (nextView !== 'open') setDisplayMode('list');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    const nextFieldErrors = { title: requiredText(form.title, 'Task title') };
    if (hasValidationErrors(nextFieldErrors)) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setSaving(true);
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
        setStatusMessage(form.related_project_id ? 'Project task created.' : 'Independent task created.');
      }
      closeEditor();
      await loadTasks();
      onTasksChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (task) => {
    setEditingId(task._id);
    setForm({
      title: task.title || '', description: task.description || '', status: task.status || 'todo',
      priority: task.priority || 'medium', category: task.category || 'Personal',
      due_date: toUtcDateInput(task.due_date), related_project_id: projectId(task),
      tags: (task.tags || []).join(', '),
    });
    setError(null);
    setStatusMessage(null);
    setEditorOpen(true);
  };

  const handleDone = async (task) => {
    setError(null);
    setStatusMessage(null);
    try {
      await markTaskDone(token, task._id);
      if (editingId === task._id) closeEditor();
      setStatusMessage(`“${task.title}” marked complete.`);
      await loadTasks();
      onTasksChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const moveTask = async (task, nextStatus) => {
    if (!task || task.status === nextStatus || movingTaskId) return;
    const previousTasks = tasks;
    setError(null);
    setStatusMessage(null);
    setMovingTaskId(task._id);
    setTasks((current) => current.map((item) => (
      item._id === task._id ? { ...item, status: nextStatus } : item
    )));

    try {
      const data = await updateTaskStatus(token, task._id, nextStatus);
      setTasks((current) => current.map((item) => (
        item._id === task._id ? { ...item, ...data.task } : item
      )));
      setStatusMessage(`“${task.title}” moved to ${taskLabel(nextStatus)}.`);
      onTasksChanged?.();
    } catch (err) {
      setTasks(previousTasks);
      setError(err.message);
    } finally {
      setMovingTaskId('');
      setDraggingTaskId('');
      setDragOverStatus('');
    }
  };

  const dropTask = (event, nextStatus) => {
    event.preventDefault();
    const taskId = draggingTaskId || event.dataTransfer.getData('text/plain');
    moveTask(tasks.find((task) => task._id === taskId), nextStatus);
  };

  return (
    <section className="tasks-page">
      <div className="task-page-header">
        <div>
          <p className="eyebrow">Work queue</p>
          <h2>Tasks</h2>
          <p className="module-description">
            Keep personal work independent, or connect a task to a project when it contributes to a larger goal.
          </p>
        </div>
        <button className="primary-button task-create-button" onClick={openNewTask} type="button">
          <Plus size={17} aria-hidden="true" /> New task
        </button>
      </div>

      <div className="task-overview-grid" aria-label="Task summary">
        <button className={`task-overview-card ${view === 'open' ? 'is-active' : ''}`} onClick={() => chooseView('open')} type="button">
          <span className="task-overview-icon"><ListTodo size={18} /></span><span><strong>{summary.open}</strong><small>Open tasks</small></span>
        </button>
        <button className={`task-overview-card ${view === 'today' ? 'is-active' : ''}`} onClick={() => chooseView('today')} type="button">
          <span className="task-overview-icon today"><CalendarClock size={18} /></span><span><strong>{summary.today}</strong><small>Due today</small></span>
        </button>
        <button className={`task-overview-card ${view === 'overdue' ? 'is-active' : ''}`} onClick={() => chooseView('overdue')} type="button">
          <span className="task-overview-icon overdue"><CircleAlert size={18} /></span><span><strong>{summary.overdue}</strong><small>Overdue</small></span>
        </button>
        <button className={`task-overview-card ${view === 'completed' ? 'is-active' : ''}`} onClick={() => chooseView('completed')} type="button">
          <span className="task-overview-icon complete"><CheckCircle2 size={18} /></span><span><strong>{summary.completed}</strong><small>Completed</small></span>
        </button>
      </div>

      <div className="task-scope-strip">
        <div className="task-scope-heading">
          <span>Workload structure</span>
          <strong>{summary.completionRate}% complete</strong>
        </div>
        <div className="task-scope-details">
          <span><FolderKanban size={15} />{summary.linked} project-linked</span>
          <span><UserRound size={15} />{summary.independent} independent</span>
          <div className="task-progress-track" aria-label={`${summary.completionRate}% of tracked tasks completed`}>
            <span style={{ width: `${summary.completionRate}%` }} />
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {statusMessage && <div className="alert-success">{statusMessage}</div>}

      <div className={`task-workspace ${editorOpen ? 'is-editing' : ''}`}>
        {editorOpen && (
          <form className="panel task-form task-editor-panel" noValidate onSubmit={handleSubmit}>
            <div className="task-editor-heading">
              <div><h3>{editingId ? 'Edit task' : 'New task'}</h3><p className="muted">Tasks can stand alone or belong to one project.</p></div>
              <button className="icon-button" onClick={closeEditor} title="Close editor" type="button"><X size={17} /></button>
            </div>
            <label>
              Title
              <input autoFocus className={fieldErrors.title ? 'field-invalid' : ''} value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="What needs to be done?" />
              {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
            </label>
            <label>
              Description <span className="form-hint">Optional</span>
              <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Add context, requirements, or the next step..." rows={4} />
            </label>
            <div className="form-grid two">
              <label>Status<select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{taskLabel(status)}</option>)}</select></label>
              <label>Priority<select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
              <label>Category<select value={form.category} onChange={(event) => updateForm('category', event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <label>Due date <span className="form-hint">Optional</span><input type="date" value={form.due_date} onChange={(event) => updateForm('due_date', event.target.value)} /></label>
            </div>
            <label>
              Project <span className="form-hint">Optional</span>
              <select value={form.related_project_id} onChange={(event) => updateForm('related_project_id', event.target.value)}>
                <option value="">Independent task</option>
                {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
              </select>
              <span className="form-hint">Leave unassigned for personal or standalone work.</span>
            </label>
            <label>Tags <span className="form-hint">Optional, separated by commas</span><input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="server, network, urgent" /></label>
            <div className="task-editor-actions">
              <button className="secondary-button" onClick={closeEditor} type="button">Cancel</button>
              <button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create task'}</button>
            </div>
          </form>
        )}

        <div className="panel task-catalog">
          <div className="task-toolbar">
            <div><h3>{view === 'completed' ? 'Completed tasks' : view === 'open' && displayMode === 'board' ? 'Task board' : view === 'open' ? 'Open tasks' : `${taskLabel(view)} tasks`}</h3><p className="muted">{filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} shown</p></div>
            <div className="task-toolbar-controls">
              {view === 'open' && (
                <div className="task-view-toggle" aria-label="Task layout">
                  <button className={displayMode === 'board' ? 'is-active' : ''} onClick={() => setDisplayMode('board')} title="Board view" type="button"><LayoutGrid size={15} /></button>
                  <button className={displayMode === 'list' ? 'is-active' : ''} onClick={() => setDisplayMode('list')} title="List view" type="button"><List size={15} /></button>
                </div>
              )}
              <label className="task-search"><Search size={16} /><input aria-label="Search tasks" onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks..." value={query} /></label>
              {view === 'open' && <select aria-label="Filter by status" className="task-filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value="all">All statuses</option>{(displayMode === 'board' ? boardStatuses : activeStatuses).map((status) => <option key={status} value={status}>{taskLabel(status)}</option>)}</select>}
              <select aria-label="Filter by priority" className="task-filter" onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}><option value="all">All priorities</option>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
              <select aria-label="Filter by project" className="task-filter" onChange={(event) => setProjectFilter(event.target.value)} value={projectFilter}><option value="all">All task types</option><option value="independent">Independent only</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select>
              <select aria-label="Sort tasks" className="task-filter" onChange={(event) => setSortMode(event.target.value)} value={sortMode}>
                <option value="due">Sort: due date</option><option value="priority">Sort: priority</option><option value="title">Sort: title</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="task-empty-state"><span><ClipboardCheck size={22} /></span><p>Loading your work queue...</p></div>
          ) : taskGroups.length === 0 ? (
            <div className="task-empty-state">
              <span><ClipboardCheck size={22} /></span><h3>No matching tasks</h3>
              <p className="muted">Adjust the filters, or create a task to add work to this view.</p>
              <button className="primary-button" onClick={openNewTask} type="button"><Plus size={16} />New task</button>
            </div>
          ) : displayMode === 'board' && view === 'open' ? (
            <div className="task-board">
              {boardColumns.map((column) => (
                <section
                  className={`task-board-column status-${column.status} ${dragOverStatus === column.status ? 'is-drag-over' : ''}`}
                  key={column.status}
                  onDragEnter={(event) => { event.preventDefault(); setDragOverStatus(column.status); }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setDragOverStatus('');
                  }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(event) => dropTask(event, column.status)}
                >
                  <div className="task-board-column-heading">
                    <span className={`task-status-dot ${column.status}`} />
                    <h4>{column.label}</h4>
                    <strong>{column.tasks.length}</strong>
                  </div>
                  <div className="task-board-stack">
                    {column.tasks.length === 0 ? (
                      <div className="task-board-empty">No tasks here</div>
                    ) : column.tasks.map((task) => (
                      <article
                        className={`task-board-card priority-${task.priority} ${draggingTaskId === task._id ? 'is-dragging' : ''}`}
                        draggable={!movingTaskId}
                        key={task._id}
                        onDragEnd={() => { setDraggingTaskId(''); setDragOverStatus(''); }}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', task._id);
                          setDraggingTaskId(task._id);
                        }}
                      >
                        <div className="task-board-card-heading">
                          <button className="task-complete-button" onClick={() => handleDone(task)} title="Mark task complete" type="button"><Circle size={17} /></button>
                          <h5>{task.title}</h5>
                          <button className="icon-button task-edit-button" onClick={() => handleEdit(task)} title="Edit task" type="button"><Pencil size={14} /></button>
                        </div>
                        {task.description && <p>{task.description}</p>}
                        <div className="task-board-card-meta">
                          <span className={`priority-pill ${task.priority}`}>{task.priority}</span>
                          <span className={`task-due-chip ${dueState(task)}`}><CalendarClock size={13} />{dueState(task) === 'overdue' ? 'Overdue · ' : ''}{formatLocalDate(task.due_date, 'No due date')}</span>
                        </div>
                        <div className="task-board-scope">
                          {taskProject(task) ? <span className="task-project-chip"><FolderKanban size={13} />{taskProject(task)}</span> : <span className="task-independent-chip"><UserRound size={13} />Independent</span>}
                          <span>{task.category}</span>
                        </div>
                        <label className="task-board-move">
                          <span>Move to</span>
                          <select
                            aria-label={`Move ${task.title} to another status`}
                            disabled={movingTaskId === task._id}
                            onChange={(event) => moveTask(task, event.target.value)}
                            value={task.status}
                          >
                            {boardStatuses.map((status) => <option key={status} value={status}>{taskLabel(status)}</option>)}
                          </select>
                        </label>
                        {task.tags?.length > 0 && <div className="tag-row">{task.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="task-groups">
              {taskGroups.map((group) => (
                <section className="task-group" key={group.key}>
                  <div className="task-group-heading"><h4>{group.label}</h4><span>{group.tasks.length}</span></div>
                  <div className="task-row-list">
                    {group.tasks.map((task) => (
                      <article className={`task-row priority-${task.priority}`} key={task._id}>
                        <button className={`task-complete-button ${task.status === 'done' ? 'is-complete' : ''}`} disabled={task.status === 'done'} onClick={() => handleDone(task)} title={task.status === 'done' ? 'Completed' : 'Mark task complete'} type="button">
                          {task.status === 'done' ? <Check size={15} /> : <Circle size={17} />}
                        </button>
                        <div className="task-row-content">
                          <div className="task-row-heading">
                            <div><h5>{task.title}</h5>{task.description && <p>{task.description}</p>}</div>
                            <span className={`priority-pill ${task.priority}`}>{task.priority}</span>
                          </div>
                          <div className="task-row-meta">
                            <span className={`task-status-badge ${task.status}`}>{taskLabel(task.status)}</span>
                            <span>{task.category}</span>
                            {taskProject(task) ? <span className="task-project-chip"><FolderKanban size={13} />{taskProject(task)}</span> : <span className="task-independent-chip">Independent</span>}
                            <span className={`task-due-chip ${dueState(task)}`}><CalendarClock size={13} />{dueState(task) === 'overdue' ? 'Overdue · ' : ''}{formatLocalDate(task.due_date, 'No due date')}</span>
                          </div>
                          {task.tags?.length > 0 && <div className="tag-row">{task.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                        </div>
                        <button className="icon-button task-edit-button" onClick={() => handleEdit(task)} title="Edit task" type="button"><Pencil size={15} /></button>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
