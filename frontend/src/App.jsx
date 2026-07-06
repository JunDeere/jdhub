import { useEffect, useState } from 'react';
import CommandCenter from './pages/CommandCenter.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Finance from './pages/Finance.jsx';
import Integrations from './pages/Integrations.jsx';
import KnowledgeBase from './pages/KnowledgeBase.jsx';
import LifeLog from './pages/LifeLog.jsx';
import Projects from './pages/Projects.jsx';
import Reminders from './pages/Reminders.jsx';
import Scheduling from './pages/Scheduling.jsx';
import ServerManager from './pages/ServerManager.jsx';
import Tasks from './pages/Tasks.jsx';
import { getCurrentUser, getHealth, updateCurrentUser } from './api/auth.js';

const STORAGE_KEY = 'jdhubToken';
const THEME_KEY = 'jdhubTheme';

const navGroups = [
  {
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Dashboard', status: 'Week 3 shell' },
      { id: 'command-center', label: 'Command Center', status: 'Week 10 active' },
    ],
  },
  {
    label: 'Personal',
    items: [
      { id: 'life-log', label: 'Life Log', status: 'Week 4 done' },
      { id: 'tasks', label: 'Tasks', status: 'Week 5 done' },
      { id: 'reminders', label: 'Reminders', status: 'Week 7 active' },
      { id: 'scheduling', label: 'Scheduling', status: 'Week 7 active' },
      { id: 'finance', label: 'Finance', status: 'Week 6 done' },
    ],
  },
  {
    label: 'Work / Build',
    items: [
      { id: 'projects', label: 'Projects', status: 'Week 8 active' },
      { id: 'knowledge-base', label: 'Knowledge Base', status: 'Week 9 active' },
      { id: 'files', label: 'Files', status: 'Future module' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'receipts', label: 'Receipts', status: 'Future module' },
      { id: 'automations', label: 'Automations', status: 'Manual records later' },
      { id: 'server-manager', label: 'Server Manager', status: 'Week 12 active' },
      { id: 'integrations', label: 'Integrations', status: 'Week 12 active' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', status: 'Placeholder' },
    ],
  },
];

const pageDetails = {
  'command-center': {
    title: 'Command Center',
    eyebrow: 'Rule-based command layer',
    description: 'This will become the main place to add notes, create tasks, log expenses, search records, and review command history. The docs say this stays rule-based first, with previews before saving.',
    next: ['Add command message collection', 'Build prefix parser', 'Show action preview before writes'],
  },
  'life-log': {
    title: 'Life Log',
    eyebrow: 'Next real module',
    description: 'Life Log stores personal notes, incidents, technical fixes, ideas, health notes, and learning records.',
    next: ['Create Entry model', 'Add create/list/update/archive APIs', 'Show recent entries on Dashboard'],
  },
  tasks: {
    title: 'Tasks',
    eyebrow: 'Personal work tracking',
    description: 'Tasks will track personal, project, server, finance, and work items with status, priority, due dates, categories, and tags.',
    next: ['Create Task model', 'Add task routes', 'Show open tasks on Dashboard'],
  },
  reminders: {
    title: 'Reminders',
    eyebrow: 'Internal reminders first',
    description: 'Reminders will store things to revisit later. Email, push, Discord, or Telegram reminders are future integrations.',
    next: ['Create Reminder model', 'Add remind_at field', 'Link to tasks or projects later'],
  },
  scheduling: {
    title: 'Scheduling',
    eyebrow: 'Internal schedule first',
    description: 'Scheduling will store planned events and time blocks inside JDHub before any Google Calendar integration.',
    next: ['Create ScheduleItem model', 'Add daily/weekly views later', 'Keep Google Calendar out of MVP'],
  },
  finance: {
    title: 'Finance',
    eyebrow: 'Manual finance MVP',
    description: 'Finance starts with manual transactions, categories, and monthly totals. OCR, CSV import, and SQL are later decisions.',
    next: ['Create Transaction model', 'Add income/expense form', 'Show monthly totals'],
  },
  projects: {
    title: 'Projects',
    eyebrow: 'Build tracking',
    description: 'Projects track anything being built, planned, paused, or maintained, including JDHub itself.',
    next: ['Create Project model', 'Add notes', 'Link tasks and life logs'],
  },
  'knowledge-base': {
    title: 'Knowledge Base',
    eyebrow: 'Reusable personal docs',
    description: 'Knowledge Base will hold guides, commands, fixes, and notes that should be easy to search and reuse.',
    next: ['Use Entry type or Knowledge model', 'Add markdown-like content later', 'Add search'],
  },
  files: {
    title: 'Files',
    eyebrow: 'Private file metadata',
    description: 'Files should begin as local/private metadata linked to modules. Google Drive integration comes later.',
    next: ['Plan upload safety', 'Store metadata', 'Protect downloads'],
  },
  receipts: {
    title: 'Receipts',
    eyebrow: 'Manual receipt records',
    description: 'Receipts start as manual merchant, amount, date, category, and notes records, then link to finance transactions.',
    next: ['Create Receipt model later', 'Link to transactions', 'Leave OCR for future work'],
  },
  automations: {
    title: 'Automations',
    eyebrow: 'Manual records only',
    description: 'Automations will document n8n, Make.com, bots, and workflows. Triggering webhooks is not part of the MVP.',
    next: ['Store platform and status', 'Store purpose and notes', 'Require confirmation for future triggers'],
  },
  'server-manager': {
    title: 'Server Manager',
    eyebrow: 'Manual infrastructure notes',
    description: 'Server Manager starts as notes and records for servers, containers, ports, domains, and incidents. No shell commands from the app.',
    next: ['Add server records later', 'Track incidents manually', 'Keep live controls out of MVP'],
  },
  integrations: {
    title: 'Integrations',
    eyebrow: 'Later enhancement',
    description: 'Integrations are tracked for future planning, but the core modules should work before connecting outside services.',
    next: ['Store provider/status later', 'No OAuth in MVP', 'JDHub remains source of truth'],
  },
};

function findNavItem(pageId) {
  return navGroups.flatMap((group) => group.items).find((item) => item.id === pageId);
}

function getSystemTheme() {
  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getNextThemeMode(theme) {
  if (theme === 'system') return 'dark';
  if (theme === 'dark') return 'light';
  return 'system';
}

function ThemeControls({ theme, resolvedTheme, onThemeChange }) {
  return (
    <div className="theme-controls">
      <div className="control-row">
        <div>
          <h3>Appearance</h3>
          <p className="muted">
            Teal is the fixed JDHub palette. System mode follows your browser or Windows theme.
          </p>
        </div>
        <div className="segmented-control" aria-label="Theme mode">
          {['system', 'light', 'dark'].map((mode) => (
            <button
              className={theme === mode ? 'selected' : ''}
              key={mode}
              onClick={() => onThemeChange(mode)}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="palette-summary">
        <span className="swatch palette-teal" />
        <div>
          <strong>Teal palette</strong>
          <small>Current display: {resolvedTheme}</small>
        </div>
      </div>
    </div>
  );
}

function ProfileSettings({ token, user, onUserChange }) {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
  }, [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setSaving(true);

    try {
      const data = await updateCurrentUser(token, { name, phone });
      onUserChange(data.user);
      setStatus({ type: 'success', message: 'Profile saved.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <div className="control-row">
        <div>
          <h3>Profile</h3>
          <p className="muted">Email is locked for now. Phone verification will be added later.</p>
        </div>
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </div>

      <div className="form-grid">
        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
          />
        </label>

        <label>
          Email
          <input value={user?.email || ''} disabled />
        </label>

        <label>
          Phone number
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+63..."
          />
        </label>
      </div>

      {status && (
        <div className={status.type === 'error' ? 'alert-error' : 'alert-success'}>
          {status.message}
        </div>
      )}
    </form>
  );
}

function SettingsPage({ token, user, theme, resolvedTheme, onThemeChange, onUserChange }) {
  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">System preferences</p>
          <h2>Settings</h2>
        </div>
        <span className="status-pill">Local only</span>
      </div>

      <p className="module-description">
        Settings will eventually control profile, categories, tags, privacy, backups, and integration settings. Appearance is safe to add now because it does not affect data model or integrations.
      </p>

      <div className="panel">
        <ProfileSettings token={token} user={user} onUserChange={onUserChange} />
      </div>

      <div className="panel">
        <ThemeControls
          theme={theme}
          resolvedTheme={resolvedTheme}
          onThemeChange={onThemeChange}
        />
      </div>
    </section>
  );
}

function ModulePage({ pageId }) {
  const details = pageDetails[pageId];
  const item = findNavItem(pageId);

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{details.eyebrow}</p>
          <h2>{details.title}</h2>
        </div>
        <span className="status-pill">{item?.status || 'Planned'}</span>
      </div>

      <p className="module-description">{details.description}</p>

      <div className="panel">
        <h3>Next Build Notes</h3>
        <ul className="plain-list">
          {details.next.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [health, setHealth] = useState(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(token));
  const [activePage, setActivePage] = useState('dashboard');
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'system');
  const [resolvedTheme, setResolvedTheme] = useState(
    (localStorage.getItem(THEME_KEY) || 'system') === 'system' ? getSystemTheme() : localStorage.getItem(THEME_KEY),
  );

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e) => setHealth({ error: e.message }));
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setCheckingSession(false);
      return;
    }

    setCheckingSession(true);
    getCurrentUser(token)
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, [token]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => {
      setResolvedTheme(theme === 'system' ? getSystemTheme() : theme);
    };

    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);

    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.palette = 'teal';
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, resolvedTheme]);

  const handleLogin = (newToken, loggedInUser) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setUser(loggedInUser);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
    setActivePage('dashboard');
  };

  const activeItem = findNavItem(activePage);
  const currentPage = activePage === 'dashboard'
    ? <Dashboard token={token} health={health} refreshKey={dashboardRefreshKey} />
    : activePage === 'command-center'
      ? <CommandCenter token={token} onCommandSaved={() => setDashboardRefreshKey((key) => key + 1)} />
    : activePage === 'settings'
      ? (
        <SettingsPage
          token={token}
          user={user}
          theme={theme}
          resolvedTheme={resolvedTheme}
          onThemeChange={setTheme}
          onUserChange={setUser}
        />
      )
      : activePage === 'life-log'
        ? <LifeLog token={token} onEntriesChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : activePage === 'tasks'
        ? <Tasks token={token} onTasksChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : activePage === 'finance'
        ? <Finance token={token} onTransactionsChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : activePage === 'reminders'
        ? <Reminders token={token} onRemindersChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : activePage === 'scheduling'
        ? <Scheduling token={token} onScheduleChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : activePage === 'projects'
        ? <Projects token={token} onProjectsChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : activePage === 'knowledge-base'
        ? <KnowledgeBase token={token} onKnowledgeChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : activePage === 'server-manager'
        ? <ServerManager token={token} onServerRecordsChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : activePage === 'integrations'
        ? <Integrations token={token} onIntegrationsChanged={() => setDashboardRefreshKey((key) => key + 1)} />
      : <ModulePage pageId={activePage} />;

  return (
    <>
      {checkingSession ? (
        <div className="auth-screen">
          <div className="auth-card">
            <h1>JDHub</h1>
            <p>Checking session...</p>
          </div>
        </div>
      ) : token ? (
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand-block">
              <div className="brand-mark">JD</div>
              <div>
                <h1>JDHub</h1>
                <p>Private command center</p>
              </div>
            </div>

            <nav className="sidebar-nav" aria-label="Main navigation">
              {navGroups.map((group) => (
                <div className="nav-group" key={group.label}>
                  <p className="nav-label">{group.label}</p>
                  {group.items.map((item) => (
                    <button
                      className={item.id === activePage ? 'nav-item active' : 'nav-item'}
                      key={item.id}
                      onClick={() => setActivePage(item.id)}
                      type="button"
                    >
                      <span>{item.label}</span>
                      <small>{item.status}</small>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          <div className="workspace">
            <header className="topbar">
              <div>
                <p className="eyebrow">Current view</p>
                <h2>{activeItem?.label || 'Dashboard'}</h2>
              </div>

              <div className="command-preview">
                <input
                  aria-label="Command Center placeholder"
                  disabled
                  placeholder="Command Center placeholder: add note: today I fixed nginx"
                />
              </div>

              <div className="user-area">
                <button
                  className="icon-button"
                  onClick={() => setTheme(getNextThemeMode(theme))}
                  title="Cycle system, dark, and light theme modes"
                  type="button"
                >
                  {theme === 'system' ? `System: ${resolvedTheme}` : theme}
                </button>
                {user?.email && <span>{user.email}</span>}
                <button className="secondary-button" onClick={handleLogout} type="button">
                  Logout
                </button>
              </div>
            </header>

            <main className="content-area">{currentPage}</main>

            <footer className="system-footer">
              <span>API: {health?.services?.api || health?.status || 'checking'}</span>
              <span>Database: {health?.services?.database || 'checking'}</span>
            </footer>
          </div>
        </div>
      ) : (
        <div className="auth-screen">
          <div className="auth-card">
            <div className="auth-heading">
              <h1>JDHub</h1>
              <p>Private personal command center</p>
            </div>
            <Login onLogin={handleLogin} />
          </div>
        </div>
      )}
    </>
  );
}
