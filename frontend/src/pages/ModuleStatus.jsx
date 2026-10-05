import { useEffect, useState } from 'react';
import { getDashboard } from '../api/auth.js';

const moduleLabels = {
  lifeLog: 'Notes',
  tasks: 'Tasks',
  finance: 'Finance',
  projects: 'Projects',
  knowledgeBase: 'Knowledge Base',
  serverManager: 'Infrastructure',
  integrations: 'Integrations',
  attention: 'Attention',
  scheduling: 'Scheduling',
  commandCenter: 'Command Center',
  files: 'Files',
};

const plannedModules = [
  ['Automations', 'Planned'],
];

function statusTone(value) {
  const normalized = String(value).toLowerCase();
  if (normalized.startsWith('ready')) return 'Ready';
  if (normalized.startsWith('no ')) return 'Idle';
  if (normalized.includes('overdue') || normalized.includes('needs attention')) return 'Needs attention';
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
