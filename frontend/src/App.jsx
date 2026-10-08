import {
  Activity,
  Bell,
  BookLock,
  BookOpen,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  FolderKanban,
  House,
  Menu,
  Plug,
  SearchCheck,
  ShieldCheck,
  Send,
  Server,
  Settings,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import CommandCenter from './pages/CommandCenter.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Diary from './pages/Diary.jsx';
import Finance from './pages/Finance.jsx';
import Files from './pages/Files.jsx';
import Integrations from './pages/Integrations.jsx';
import KnowledgeBase from './pages/KnowledgeBase.jsx';
import LifeLog from './pages/LifeLog.jsx';
import ModuleStatus from './pages/ModuleStatus.jsx';
import Projects from './pages/Projects.jsx';
import PublicShare from './pages/PublicShare.jsx';
import Scheduling from './pages/Scheduling.jsx';
import ServerManager from './pages/ServerManager.jsx';
import Security from './pages/Security.jsx';
import Tasks from './pages/Tasks.jsx';
import { getCurrentUser, getDashboard, getHealth, updateCurrentUser } from './api/auth.js';
import { buildAttentionItems } from './utils/attention.js';
import { installPortfolioBridge, waitForPortfolioPage } from './portfolioBridge.js';

const STORAGE_KEY = 'jdhubToken';
const THEME_KEY = 'jdhubTheme';
const SIDEBAR_KEY = 'jdhubSidebarCollapsed';
const ASSISTANT_WIDTH_KEY = 'jdhubAssistantWidth';

const navIcons = {
  dashboard: House,
  'command-center': SearchCheck,
  'life-log': FileText,
  diary: BookLock,
  tasks: ClipboardList,
  scheduling: CalendarDays,
  finance: CircleDollarSign,
  projects: FolderKanban,
  'knowledge-base': BookOpen,
  files: FileText,
  automations: Bot,
  'server-manager': Server,
  integrations: Plug,
  'module-status': Activity,
  settings: Settings,
  security: ShieldCheck,
};

const navGroups = [
  {
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Home' },
      { id: 'command-center', label: 'Command Center' },
    ],
  },
  {
    label: 'Personal',
    items: [
      { id: 'diary', label: 'Diary' },
      { id: 'life-log', label: 'Notes' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'scheduling', label: 'Scheduling' },
      { id: 'finance', label: 'Finance' },
    ],
  },
  {
    label: 'Work / Build',
    items: [
      { id: 'projects', label: 'Projects' },
      { id: 'knowledge-base', label: 'Knowledge Base' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'files', label: 'Files' },
      { id: 'automations', label: 'Automations', disabled: true },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'security', label: 'Administration', adminOnly: true },
      { id: 'server-manager', label: 'Infrastructure', adminOnly: true },
      { id: 'integrations', label: 'Integrations', adminOnly: true },
      { id: 'module-status', label: 'Module Status' },
      { id: 'settings', label: 'Settings' },
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
    title: 'Notes',
    eyebrow: 'Personal records',
    description: 'Notes stores personal records, incidents, technical fixes, ideas, health notes, and learning records.',
    next: ['Create Entry model', 'Add create/list/update/archive APIs', 'Show recent entries on Dashboard'],
  },
  tasks: {
    title: 'Tasks',
    eyebrow: 'Personal work tracking',
    description: 'Tasks will track personal, project, server, finance, and work items with status, priority, due dates, categories, and tags.',
    next: ['Create Task model', 'Add task routes', 'Show open tasks on Dashboard'],
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
    next: ['Create Project model', 'Add notes', 'Link tasks and notes'],
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
    state: 'Planned',
    description: 'Files should begin as local/private metadata linked to modules. Google Drive integration comes later.',
    next: ['Plan upload safety', 'Store metadata', 'Protect downloads'],
  },
  automations: {
    title: 'Automations',
    eyebrow: 'Manual records only',
    state: 'Planned',
    description: 'Automations will document n8n, Make.com, bots, and workflows. Triggering webhooks is not part of the MVP.',
    next: ['Store platform and status', 'Store purpose and notes', 'Require confirmation for future triggers'],
  },
  'server-manager': {
    title: 'Infrastructure',
    eyebrow: 'Infrastructure records',
    description: 'Infrastructure stores administrative records for servers, containers, ports, domains, and incidents. No shell commands run from the app.',
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

function buildNotifications(dashboard, health) {
  if (!dashboard) return [];

  const items = [...buildAttentionItems(dashboard)];

  if (!dashboard.recentEntries?.length) {
    items.push({
      id: 'first-note',
      title: 'Write your first note',
      detail: 'Use Notes for quick thoughts, fixes, and incidents.',
      action: 'Open Notes',
      page: 'life-log',
    });
  }

  if (!dashboard.openTasks?.length) {
    items.push({
      id: 'first-task',
      title: 'Create your first task',
      detail: 'Track the next action you want JDHub to remember.',
      action: 'Open Tasks',
      page: 'tasks',
    });
  }

  if (!dashboard.activeProjects?.length) {
    items.push({
      id: 'first-project',
      title: 'Add a project',
      detail: 'Group builds, maintenance work, and longer ideas.',
      action: 'Open Projects',
      page: 'projects',
    });
  }

  if (!dashboard.financeSummary?.income && !dashboard.financeSummary?.expense) {
    items.push({
      id: 'first-transaction',
      title: 'Log a transaction',
      detail: 'Start monthly finance totals with income or expenses.',
      action: 'Open Finance',
      page: 'finance',
    });
  }

  if (health?.status !== 'ok' || health?.services?.database !== 'connected') {
    items.push({
      id: 'system-warning',
      title: 'System status needs attention',
      detail: 'API or database health is not fully available.',
      action: 'View status',
      page: 'module-status',
    });
  }

  return items;
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
        <ProfileSettings
          key={user?._id || user?.email || 'profile'}
          token={token}
          user={user}
          onUserChange={onUserChange}
        />
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

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{details.eyebrow}</p>
          <h2>{details.title}</h2>
        </div>
        <span className="status-pill">{details.state || 'Planned'}</span>
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

function PrivateApp() {
  const [token, setToken] = useState(localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [health, setHealth] = useState(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(token));
  const [activePage, setActivePage] = useState('dashboard');
  const [pageHistory, setPageHistory] = useState([]);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [moduleRefreshKey, setModuleRefreshKey] = useState(0);
  const [notificationDashboard, setNotificationDashboard] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState('closed');
  const [assistantWidth, setAssistantWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem(ASSISTANT_WIDTH_KEY));
    return Number.isFinite(savedWidth) && savedWidth >= 320 ? savedWidth : 410;
  });
  const [topbarPrompt, setTopbarPrompt] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(localStorage.getItem(SIDEBAR_KEY) === 'true');
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'system');
  const [portfolioHighlight, setPortfolioHighlight] = useState(null);
  const [resolvedTheme, setResolvedTheme] = useState(
    (localStorage.getItem(THEME_KEY) || 'system') === 'system' ? getSystemTheme() : localStorage.getItem(THEME_KEY),
  );
  const assistantRef = useRef(null);
  const portfolioStopRef = useRef(() => {});
  const activePageRef = useRef(activePage);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e) => setHealth({ error: e.message }));
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    getCurrentUser(token)
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
        setNotificationDashboard(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    getDashboard(token)
      .then(setNotificationDashboard)
      .catch(() => setNotificationDashboard(null));
  }, [token, dashboardRefreshKey]);

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

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleLogin = useCallback((newToken, loggedInUser) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setCheckingSession(true);
    setUser(loggedInUser);
    setToken(newToken);
  }, []);

  const handleLogout = () => {
    portfolioStopRef.current();
    setPortfolioHighlight(null);
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
    setNotificationDashboard(null);
    setAssistantMode('closed');
    setTopbarPrompt('');
    setCheckingSession(false);
    activePageRef.current = 'dashboard';
    setActivePage('dashboard');
    setPageHistory([]);
  };

  const handleDataChanged = useCallback(() => {
    setDashboardRefreshKey((key) => key + 1);
  }, []);

  const handleAssistantDataChanged = useCallback(() => {
    setDashboardRefreshKey((key) => key + 1);
    setModuleRefreshKey((key) => key + 1);
  }, []);

  const navigateToPage = useCallback((pageId) => {
    const target = findNavItem(pageId);
    if (target?.adminOnly && user?.role !== 'admin') return;
    const previousPage = activePageRef.current;
    setPageHistory((current) => (pageId === previousPage ? current : [...current, previousPage].slice(-20)));
    activePageRef.current = pageId;
    setActivePage(pageId);
    setMobileSidebarOpen(false);
  }, [user?.role]);

  useEffect(() => {
    if (user?.isDemo !== true) return undefined;
    let highlightTimer;
    const stop = installPortfolioBridge({
      isDemo: user.isDemo,
      navigate: (pageId, cursorRequested, signal) => {
        navigateToPage(pageId);
        if (cursorRequested) setPortfolioHighlight(pageId);
        window.clearTimeout(highlightTimer);
        highlightTimer = window.setTimeout(() => setPortfolioHighlight(null), 1800);
        return waitForPortfolioPage({
          signal,
          isRendered: () => activePageRef.current === pageId
            && Boolean(document.querySelector(`[data-active-page="${pageId}"]`)),
        });
      },
    });
    const cleanup = () => {
      window.clearTimeout(highlightTimer);
      stop();
    };
    portfolioStopRef.current = cleanup;
    return cleanup;
  }, [navigateToPage, user?.isDemo]);

  const navigateBack = () => {
    setPageHistory((current) => {
      const previousPage = current[current.length - 1] || 'dashboard';
      activePageRef.current = previousPage;
      setActivePage(previousPage);
      setMobileSidebarOpen(false);
      setNotificationsOpen(false);
      return current.slice(0, -1);
    });
  };

  const handleSidebarToggle = () => {
    if (window.matchMedia('(max-width: 980px)').matches) {
      setMobileSidebarOpen(false);
      return;
    }

    setSidebarCollapsed((current) => !current);
  };

  const handleTopbarAssistantSubmit = (event) => {
    event.preventDefault();
    const prompt = topbarPrompt.trim();
    if (!prompt) {
      setAssistantMode('floating');
      assistantRef.current?.focus();
      return;
    }

    setAssistantMode('floating');
    setTopbarPrompt('');
    assistantRef.current?.submit(prompt);
  };

  const handleAssistantResizeStart = (event) => {
    event.preventDefault();
    const workspaceRight = event.currentTarget.parentElement.getBoundingClientRect().right;

    const handlePointerMove = (pointerEvent) => {
      const nextWidth = Math.min(720, Math.max(320, workspaceRight - pointerEvent.clientX));
      setAssistantWidth(nextWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const resizeAssistantWithKeyboard = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? 24 : -24;
    setAssistantWidth((current) => Math.min(720, Math.max(320, current + direction)));
  };

  useEffect(() => {
    localStorage.setItem(ASSISTANT_WIDTH_KEY, String(Math.round(assistantWidth)));
  }, [assistantWidth]);

  const activeItem = findNavItem(activePage);
  const canGoBack = pageHistory.length > 0 && activePage !== 'dashboard';
  const notifications = buildNotifications(notificationDashboard, health);
  const currentPage = activePage === 'dashboard'
    ? <Dashboard token={token} user={user} refreshKey={dashboardRefreshKey} onNavigate={navigateToPage} />
    : activePage === 'command-center'
      ? null
    : activePage === 'security'
      ? <Security token={token} />
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
    : activePage === 'module-status'
      ? <ModuleStatus token={token} health={health} refreshKey={dashboardRefreshKey} />
      : activePage === 'life-log'
        ? <LifeLog token={token} refreshKey={moduleRefreshKey} onEntriesChanged={handleDataChanged} />
      : activePage === 'diary'
        ? <Diary token={token} />
      : activePage === 'tasks'
        ? <Tasks token={token} refreshKey={moduleRefreshKey} onTasksChanged={handleDataChanged} />
      : activePage === 'finance'
        ? <Finance token={token} refreshKey={moduleRefreshKey} onTransactionsChanged={handleDataChanged} />
      : activePage === 'scheduling'
        ? <Scheduling token={token} refreshKey={moduleRefreshKey} onScheduleChanged={handleDataChanged} />
      : activePage === 'projects'
        ? <Projects token={token} refreshKey={moduleRefreshKey} onProjectsChanged={handleDataChanged} />
      : activePage === 'knowledge-base'
        ? <KnowledgeBase token={token} refreshKey={moduleRefreshKey} onKnowledgeChanged={handleDataChanged} />
      : activePage === 'files'
        ? <Files token={token} />
      : activePage === 'server-manager'
        ? <ServerManager token={token} refreshKey={moduleRefreshKey} onServerRecordsChanged={handleDataChanged} />
      : activePage === 'integrations'
        ? <Integrations token={token} refreshKey={moduleRefreshKey} onIntegrationsChanged={handleDataChanged} />
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
        <div className={[
          'app-shell',
          sidebarCollapsed ? 'sidebar-collapsed' : '',
          mobileSidebarOpen ? 'mobile-sidebar-open' : '',
        ].filter(Boolean).join(' ')}>
          <button
            aria-label="Close navigation"
            className="mobile-sidebar-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
            type="button"
          />
          <aside className="sidebar">
            <div className="brand-block">
              <div className="brand-mark">JD</div>
              <div className="brand-copy">
                <h1>JDHub</h1>
                <p>Private command center</p>
              </div>
              <button
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="sidebar-toggle"
                onClick={handleSidebarToggle}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                type="button"
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>

            <nav className="sidebar-nav" aria-label="Main navigation">
              {navGroups.map((group) => (
                <div className="nav-group" key={group.label}>
                  <p className="nav-label">{group.label}</p>
                  {group.items.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => {
                    const Icon = navIcons[item.id] || FileText;

                    return (
                      <button
                        aria-label={item.label}
                        className={[
                          'nav-item',
                          item.id === activePage ? 'active' : '',
                          item.id === portfolioHighlight ? 'portfolio-highlight' : '',
                          item.disabled ? 'disabled' : '',
                        ].filter(Boolean).join(' ')}
                        disabled={item.disabled}
                        key={item.id}
                        onClick={() => {
                          if (!item.disabled) navigateToPage(item.id);
                        }}
                        title={sidebarCollapsed ? item.label : undefined}
                        type="button"
                      >
                        <Icon aria-hidden="true" className="nav-icon" size={18} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>

          <div className={[
            'workspace',
            activePage !== 'command-center' && assistantMode === 'integrated' ? 'assistant-docked-workspace' : '',
          ].filter(Boolean).join(' ')}>
            <header className="topbar">
              <div className="topbar-title">
                <button
                  aria-expanded={mobileSidebarOpen}
                  aria-label="Open module navigation"
                  className="mobile-nav-fab"
                  onClick={() => setMobileSidebarOpen(true)}
                  type="button"
                >
                  <Menu size={19} />
                </button>
                <button
                  aria-label="Go back"
                  className="back-button"
                  disabled={!canGoBack}
                  onClick={navigateBack}
                  title={canGoBack ? 'Go back' : 'No previous page'}
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
                <div>
                  {activePage !== 'dashboard' && (
                    <button className="mobile-home-link" onClick={() => navigateToPage('dashboard')} type="button">
                      Home
                    </button>
                  )}
                  <h2>{activeItem?.label || 'Home'}</h2>
                </div>
              </div>

              <form className="command-preview assistant-topbar-entry" onSubmit={handleTopbarAssistantSubmit}>
                <Bot aria-hidden="true" size={17} />
                <input
                  aria-label="Ask JDHub or enter a command"
                  onChange={(event) => setTopbarPrompt(event.target.value)}
                  placeholder="Ask JDHub or enter a command…"
                  value={topbarPrompt}
                />
                <button aria-label="Send to JDHub Assistant" type="submit"><Send size={16} /></button>
              </form>

              <div className="user-area">
                <div className="notification-popover">
                  <button
                    aria-label="Notifications"
                    className="notification-bell"
                    onClick={() => setNotificationsOpen((current) => !current)}
                    title="Notifications"
                    type="button"
                  >
                    <Bell size={18} />
                    {notifications.length > 0 && <span>{notifications.length}</span>}
                  </button>
                  {notificationsOpen && (
                    <div className="notification-menu">
                      <div className="notification-menu-header">
                        <strong>Notifications</strong>
                        <small>{notifications.length} active</small>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="muted">No active notifications.</p>
                      ) : (
                        <div className="notification-menu-list">
                          {notifications.slice(0, 6).map((item) => (
                            <article className="notification-menu-item" key={item.id}>
                              <div>
                                <strong>{item.title}</strong>
                                <p>{item.detail}</p>
                              </div>
                              <button
                                className="secondary-button"
                                onClick={() => {
                                  navigateToPage(item.page);
                                  setNotificationsOpen(false);
                                }}
                                type="button"
                              >
                                {item.action}
                              </button>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="icon-button"
                  onClick={() => setTheme(getNextThemeMode(theme))}
                  title="Cycle system, dark, and light theme modes"
                  type="button"
                >
                  {theme === 'system' ? `System: ${resolvedTheme}` : theme}
                </button>
                {user?.email && (
                  <span className="account-identity">
                    <span>{user.email}</span>
                    {user.role === 'admin' && <span className="account-role is-admin">Administrator</span>}
                  </span>
                )}
                <button className="secondary-button" onClick={handleLogout} type="button">
                  Logout
                </button>
              </div>
            </header>

            <main className={[
              'content-area',
              activePage !== 'command-center' && assistantMode === 'integrated' ? 'assistant-docked' : '',
            ].filter(Boolean).join(' ')} data-active-page={activePage}>
              <div className={[
                'assistant-workspace',
                activePage === 'command-center' ? 'command-center-mode' : '',
                activePage !== 'command-center' && assistantMode === 'integrated' ? 'has-assistant' : '',
                activePage !== 'command-center' && assistantMode === 'floating' ? 'has-floating-assistant' : '',
              ].filter(Boolean).join(' ')} style={{ '--assistant-width': `${assistantWidth}px` }}>
                <CommandCenter
                  ref={assistantRef}
                  activeModule={activePage}
                  mode={activePage === 'command-center' ? 'page' : assistantMode === 'integrated' ? 'integrated' : assistantMode === 'floating' ? 'floating' : 'minimized'}
                  onClose={() => setAssistantMode('closed')}
                  onCommandSaved={handleAssistantDataChanged}
                  onExpand={() => setAssistantMode('floating')}
                  onIntegrate={() => setAssistantMode('integrated')}
                  onMinimize={() => setAssistantMode('floating')}
                  token={token}
                />
                {activePage !== 'command-center' && <div className="module-surface">{currentPage}</div>}
                {activePage !== 'command-center' && assistantMode === 'integrated' && (
                  <div
                    aria-label="Resize JDHub Assistant"
                    aria-orientation="vertical"
                    aria-valuemax="720"
                    aria-valuemin="320"
                    aria-valuenow={Math.round(assistantWidth)}
                    className="assistant-resizer"
                    onKeyDown={resizeAssistantWithKeyboard}
                    onPointerDown={handleAssistantResizeStart}
                    role="separator"
                    tabIndex="0"
                    title="Drag to resize the assistant"
                  />
                )}
              </div>
            </main>

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

export default function App() {
  const shareMatch = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]{32,160})\/?$/);
  if (shareMatch) return <PublicShare shareToken={shareMatch[1]} />;
  return <PrivateApp />;
}
