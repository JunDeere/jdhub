import { useEffect, useState } from 'react';
import { getDashboard } from '../api/auth.js';

const moduleLabels = {
  lifeLog: 'Notes',
  tasks: 'Tasks',
  finance: 'Finance',
  projects: 'Projects',
  knowledgeBase: 'Knowledge Base',
  serverManager: 'Server Manager',
  integrations: 'Integrations',
  reminders: 'Reminders',
  scheduling: 'Scheduling',
  commandCenter: 'Command Center',
};

const plannedModules = [
  ['Files', 'Planned'],
  ['Receipts', 'Planned'],
  ['Automations', 'Planned'],
];

function statusTone(value) {
  if (String(value).toLowerCase().startsWith('ready')) return 'Ready';
  return 'Active';
}

export default function ModuleStatus({ token, health, refreshKey }) {
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
    <section className="module-status-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">System overview</p>
          <h2>Module Status</h2>
        </div>
        <span className="status-pill">Local system</span>
      </div>

      <p className="module-description">
        Track which JDHub modules are available, ready for data, or still planned.
      </p>

      {error && <div className="alert-error">{error}</div>}

      <div className="dashboard-grid">
        <div className="panel">
          <h3>Services</h3>
          <ul className="plain-list">
            <li>
              <span>API</span>
              <strong>{health?.services?.api || health?.status || 'checking'}</strong>
            </li>
            <li>
              <span>Database</span>
              <strong>{health?.services?.database || 'checking'}</strong>
            </li>
          </ul>
        </div>

        <div className="panel">
          <h3>Planned Modules</h3>
          <ul className="plain-list">
            {plannedModules.map(([label, value]) => (
              <li key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel">
        <h3>Available Modules</h3>
        {!dashboard ? (
          <p className="muted">Loading module status...</p>
        ) : (
          <ul className="plain-list">
            {Object.entries(dashboard.sections || {}).map(([key, value]) => (
              <li key={key}>
                <span>{moduleLabels[key] || key}</span>
                <strong>{statusTone(value)} - {value}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
