import { Bell, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getDashboard } from '../api/auth.js';
import { formatLocalDate, formatLocalDateTime } from '../utils/dateTime.js';

const ONBOARDING_KEY = 'jdhubDashboardOnboardingOpen';

function money(value, currency = 'PHP') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function EmptyState({ message, action, onAction }) {
  return (
    <div className="empty-state">
      <p className="muted">{message}</p>
      <button className="secondary-button" onClick={onAction} type="button">
        {action}
      </button>
    </div>
  );
}

export default function Dashboard({ token, refreshKey, onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [onboardingOpen, setOnboardingOpen] = useState(localStorage.getItem(ONBOARDING_KEY) === 'true');

  useEffect(() => {
    let active = true;

    getDashboard(token)
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [token, refreshKey]);

  useEffect(() => {
    localStorage.setItem(ONBOARDING_KEY, String(onboardingOpen));
  }, [onboardingOpen]);

  const onboardingItems = dashboard ? [
    {
      done: Boolean(dashboard.recentEntries?.length),
      label: 'Write a note',
      description: 'Use Notes like a quick notepad for thoughts, fixes, and incidents.',
      page: 'life-log',
    },
    {
      done: Boolean(dashboard.openTasks?.length),
      label: 'Create a task',
      description: 'Track the next action you want JDHub to remember.',
      page: 'tasks',
    },
    {
      done: Boolean(dashboard.activeProjects?.length),
      label: 'Add a project',
      description: 'Group builds, maintenance work, and ideas into project records.',
      page: 'projects',
    },
    {
      done: Boolean(dashboard.financeSummary?.income || dashboard.financeSummary?.expense),
      label: 'Log a transaction',
      description: 'Start tracking income, expenses, and monthly net totals.',
      page: 'finance',
    },
    {
      done: false,
      label: 'Try Command Center',
      description: 'Use guided command chips for notes, tasks, and expenses.',
      page: 'command-center',
    },
  ] : [];

  const completedOnboarding = onboardingItems.filter((item) => item.done).length;

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Dashboard</h2>
        </div>
        <span className="status-pill">Protected</span>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {!dashboard ? (
        <p>Loading dashboard...</p>
      ) : (
        <>
          <div className={onboardingOpen ? 'panel onboarding-panel open' : 'panel onboarding-panel'}>
            <button
              className="notification-toggle"
              onClick={() => setOnboardingOpen((current) => !current)}
              type="button"
            >
              <Bell size={17} />
              <span>Getting started</span>
              <small>{completedOnboarding}/{onboardingItems.length} done</small>
              {onboardingOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            {onboardingOpen && (
              <div className="onboarding-list">
                {onboardingItems.map((item, index) => (
                  <button className="onboarding-item" key={item.label} onClick={() => onNavigate(item.page)} type="button">
                    <span>{item.done ? 'Done' : index + 1}</span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <span>Monthly income</span>
              <strong>{money(dashboard.financeSummary?.income)}</strong>
            </div>
            <div className="metric-card">
              <span>Monthly expense</span>
              <strong>{money(dashboard.financeSummary?.expense)}</strong>
            </div>
            <div className="metric-card">
              <span>Monthly net</span>
              <strong>{money(dashboard.financeSummary?.net)}</strong>
            </div>
            <div className="metric-card">
              <span>Open tasks</span>
              <strong>{dashboard.openTasks?.length || 0}</strong>
            </div>
            <div className="metric-card">
              <span>Active projects</span>
              <strong>{dashboard.activeProjects?.length || 0}</strong>
            </div>
            <div className="metric-card">
              <span>Knowledge pages</span>
              <strong>{dashboard.recentKnowledgePages?.length || 0}</strong>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="panel">
              <h3>Upcoming Reminders</h3>
              {dashboard.upcomingReminders?.length ? (
                <div className="compact-entry-list">
                  {dashboard.upcomingReminders.map((reminder) => (
                    <article key={reminder._id}>
                      <strong>{reminder.title}</strong>
                      <span>{formatLocalDateTime(reminder.remind_at)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No upcoming reminders."
                  action="Add reminder"
                  onAction={() => onNavigate('reminders')}
                />
              )}
            </div>

            <div className="panel">
              <h3>Recent Notes</h3>
              {dashboard.recentEntries?.length ? (
                <div className="compact-entry-list">
                  {dashboard.recentEntries.map((entry) => (
                    <article key={entry._id}>
                      <strong>{entry.title}</strong>
                      <span>{entry.category} / {formatLocalDateTime(entry.createdAt)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No notes yet."
                  action="Write note"
                  onAction={() => onNavigate('life-log')}
                />
              )}
            </div>

            <div className="panel">
              <h3>Open Tasks</h3>
              {dashboard.openTasks?.length ? (
                <div className="compact-entry-list">
                  {dashboard.openTasks.map((task) => (
                    <article key={task._id}>
                      <strong>{task.title}</strong>
                      <span>
                        {task.priority} priority / {task.due_date
                          ? formatLocalDate(task.due_date)
                          : 'No due date'}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No open tasks yet."
                  action="Create task"
                  onAction={() => onNavigate('tasks')}
                />
              )}
            </div>

            <div className="panel">
              <h3>Upcoming Schedule</h3>
              {dashboard.upcomingSchedule?.length ? (
                <div className="compact-entry-list">
                  {dashboard.upcomingSchedule.map((item) => (
                    <article key={item._id}>
                      <strong>{item.title}</strong>
                      <span>{formatLocalDateTime(item.start_at)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No upcoming schedule items."
                  action="Add schedule"
                  onAction={() => onNavigate('scheduling')}
                />
              )}
            </div>

            <div className="panel">
              <h3>Active Projects</h3>
              {dashboard.activeProjects?.length ? (
                <div className="compact-entry-list">
                  {dashboard.activeProjects.map((project) => (
                    <article key={project._id}>
                      <strong>{project.name}</strong>
                      <span>{project.priority} priority / {project.status}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No active projects yet."
                  action="Create project"
                  onAction={() => onNavigate('projects')}
                />
              )}
            </div>

            <div className="panel">
              <h3>Knowledge Base</h3>
              {dashboard.recentKnowledgePages?.length ? (
                <div className="compact-entry-list">
                  {dashboard.recentKnowledgePages.map((page) => (
                    <article key={page._id}>
                      <strong>{page.title}</strong>
                      <span>{formatLocalDateTime(page.updatedAt || page.createdAt)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No knowledge pages yet."
                  action="Create page"
                  onAction={() => onNavigate('knowledge-base')}
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
