import { useEffect, useState } from 'react';
import { getDashboard } from '../api/auth.js';

function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function money(value, currency = 'PHP') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function Dashboard({ token, health, refreshKey }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);

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

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Week 5 active</p>
          <h2>Dashboard</h2>
        </div>
        <span className="status-pill">Protected</span>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {!dashboard ? (
        <p>Loading dashboard...</p>
      ) : (
        <>
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
                      <span>{formatDate(reminder.remind_at)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">No upcoming reminders.</p>
              )}
            </div>

            <div className="panel">
              <h3>Recent Life Log</h3>
              {dashboard.recentEntries?.length ? (
                <div className="compact-entry-list">
                  {dashboard.recentEntries.map((entry) => (
                    <article key={entry._id}>
                      <strong>{entry.title}</strong>
                      <span>{entry.category} / {formatDate(entry.createdAt)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">No Life Log entries yet.</p>
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
                          ? formatDate(task.due_date, { dateStyle: 'medium' })
                          : 'No due date'}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">No open tasks yet.</p>
              )}
            </div>

            <div className="panel">
              <h3>Upcoming Schedule</h3>
              {dashboard.upcomingSchedule?.length ? (
                <div className="compact-entry-list">
                  {dashboard.upcomingSchedule.map((item) => (
                    <article key={item._id}>
                      <strong>{item.title}</strong>
                      <span>{formatDate(item.start_at)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">No upcoming schedule items.</p>
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
                <p className="muted">No active projects yet.</p>
              )}
            </div>

            <div className="panel">
              <h3>Knowledge Base</h3>
              {dashboard.recentKnowledgePages?.length ? (
                <div className="compact-entry-list">
                  {dashboard.recentKnowledgePages.map((page) => (
                    <article key={page._id}>
                      <strong>{page.title}</strong>
                      <span>{formatDate(page.updatedAt || page.createdAt)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">No knowledge pages yet.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <h3>Module Status</h3>
            <ul className="plain-list">
              {Object.entries(dashboard.sections || {}).map(([key, value]) => (
                <li key={key}>
                  <span>{key}</span>
                  <strong>{value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
