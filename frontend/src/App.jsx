import {
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
  Files as FilesIcon,
  FolderKanban,
  Gauge,
  House,
  Menu,
  NotebookPen,
  Plug,
  ShieldCheck,
  Send,
  Server,
  Settings,
  Sparkles,
  Star,
  CheckCheck,
  X,
} from 'lucide-react';
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import CommandCenter from './pages/CommandCenter.jsx';
import ConnectionCenter from './components/ConnectionCenter.jsx';
import NotificationPreferences from './components/NotificationPreferences.jsx';
import Login from './pages/Login.jsx';
import { getCurrentUser, getHealth, logout, updateCurrentUser } from './api/auth.js';
import { getNotifications, markAllNotificationsRead, updateNotificationState } from './api/notifications.js';
import { installPortfolioBridge, waitForPortfolioPage } from './portfolioBridge.js';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Diary = lazy(() => import('./pages/Diary.jsx'));
const Finance = lazy(() => import('./pages/Finance.jsx'));
const Files = lazy(() => import('./pages/Files.jsx'));
const Integrations = lazy(() => import('./pages/Integrations.jsx'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase.jsx'));
const LifeLog = lazy(() => import('./pages/LifeLog.jsx'));
const ModuleStatus = lazy(() => import('./pages/ModuleStatus.jsx'));
const Projects = lazy(() => import('./pages/Projects.jsx'));
const PublicShare = lazy(() => import('./pages/PublicShare.jsx'));
const Reviews = lazy(() => import('./pages/Reviews.jsx'));
const Scheduling = lazy(() => import('./pages/Scheduling.jsx'));
const Security = lazy(() => import('./pages/Security.jsx'));
const ServerManager = lazy(() => import('./pages/ServerManager.jsx'));
const Tasks = lazy(() => import('./pages/Tasks.jsx'));

const STORAGE_KEY = 'jdhubToken';
const THEME_KEY = 'jdhubTheme';
const SIDEBAR_KEY = 'jdhubSidebarCollapsed';
const SIDEBAR_WIDTH_KEY = 'jdhubSidebarWidth';
const ASSISTANT_WIDTH_KEY = 'jdhubAssistantWidth';
const PORTFOLIO_DEMO_PAGE_IDS = new Set(['dashboard', 'projects', 'tasks', 'scheduling', 'knowledge-base']);
const DIRECT_HASH_PAGE_IDS = new Set([...PORTFOLIO_DEMO_PAGE_IDS, 'reviews', 'settings']);

function ModuleLoading() {
  return (
    <div className="module-loading" role="status">
      <span className="module-loading-spinner" />
      <span>Loading module…</span>
    </div>
  );
}

function initialActivePage() {
  const requested = window.location.hash.slice(1);
  return DIRECT_HASH_PAGE_IDS.has(requested) ? requested : 'dashboard';
}

const navIcons = {
  dashboard: House,
  'command-center': Sparkles,
  'life-log': NotebookPen,
  diary: BookLock,
  reviews: Star,
  tasks: ClipboardList,
  scheduling: CalendarDays,
  finance: CircleDollarSign,
  projects: FolderKanban,
  'knowledge-base': BookOpen,
  files: FilesIcon,
  automations: Bot,
  'server-manager': Server,
  integrations: Plug,
  'module-status': Gauge,
  settings: Settings,
  security: ShieldCheck,
};

const navGroups = [
  {
    label: 'Core',
    tone: 'core',
    items: [
      { id: 'dashboard', label: 'Home' },
      { id: 'command-center', label: 'Ask JDHub' },
    ],
  },
  {
    label: 'Personal',
    tone: 'personal',
    items: [
      { id: 'diary', label: 'Diary' },
      { id: 'reviews', label: 'Reviews' },
      { id: 'life-log', label: 'Notes' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'scheduling', label: 'Scheduling' },
      { id: 'finance', label: 'Finance' },
    ],
  },
  {
    label: 'Work / Build',
    tone: 'work',
    items: [
      { id: 'projects', label: 'Projects' },
      { id: 'knowledge-base', label: 'Knowledge Base' },
    ],
  },
  {
    label: 'Tools',
    tone: 'tools',
    items: [
      { id: 'files', label: 'Files' },
      { id: 'automations', label: 'Automations', disabled: true },
    ],
  },
  {
    label: 'System',
    tone: 'system',
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
    title: 'Ask JDHub',
    eyebrow: 'Unified search and actions',
    description: 'Ask naturally to find records across JDHub or prepare a safe action for confirmation.',
    next: ['Search safe modules', 'Answer from matching records', 'Confirm before every write'],
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

const regionNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;
const phoneCountries = getCountries()
  .map((country) => ({
    code: country,
    callingCode: getCountryCallingCode(country),
    name: regionNames?.of(country) || country,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

function initialPhoneValues(value) {
  const parsed = value ? parsePhoneNumberFromString(value) : null;
  return {
    country: parsed?.country || 'PH',
    nationalNumber: parsed?.formatNational() || String(value || ''),
  };
}

function ProfileSettings({ token, user, onUserChange }) {
  const initialPhone = initialPhoneValues(user?.phone);
  const [name, setName] = useState(user?.name || '');
  const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
  const [phone, setPhone] = useState(initialPhone.nationalNumber);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setSaving(true);

    try {
      let normalizedPhone = '';
      if (phone.trim()) {
        const parsed = parsePhoneNumberFromString(phone, phoneCountry);
        if (!parsed?.isValid() || parsed.country !== phoneCountry) {
          throw new Error('Enter a valid phone number for the selected country.');
        }
        normalizedPhone = parsed.number;
      }

      const data = await updateCurrentUser(token, { name, phone: normalizedPhone });
      onUserChange(data.user);
      const savedPhone = initialPhoneValues(data.user.phone);
      setPhoneCountry(savedPhone.country);
      setPhone(savedPhone.nationalNumber);
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

        <label className="profile-phone-field">
          Phone number
          <div className="profile-phone-control">
            <select
              aria-label="Phone country"
              value={phoneCountry}
              onChange={(event) => setPhoneCountry(event.target.value)}
            >
              {phoneCountries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} (+{country.callingCode})
                </option>
              ))}
            </select>
            <input
              aria-label="National phone number"
              autoComplete="tel-national"
              inputMode="tel"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="National phone number"
            />
          </div>
          <small>Validated for the selected country and saved internationally.</small>
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

function SettingsPage({ token, user, theme, resolvedTheme, onThemeChange, onUserChange, onNavigate, onNotificationsChanged }) {
  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Account preferences</p>
          <h2>Settings</h2>
        </div>
        <span className="status-pill">Account</span>
      </div>

      <p className="module-description">
        Manage your profile, connected accounts, and display preferences in one place.
      </p>

      <div className="panel">
        <ProfileSettings
          key={user?._id || user?.email || 'profile'}
          token={token}
          user={user}
          onUserChange={onUserChange}
        />
      </div>

      <ConnectionCenter token={token} user={user} onNavigate={onNavigate} />

      <NotificationPreferences token={token} onChanged={onNotificationsChanged} />

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
  const [activePage, setActivePage] = useState(initialActivePage);
  const [pageHistory, setPageHistory] = useState([]);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [moduleRefreshKey, setModuleRefreshKey] = useState(0);
  const [notificationData, setNotificationData] = useState({ notifications: [], unreadCount: 0, preferences: {} });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState('closed');
  const [assistantWidth, setAssistantWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem(ASSISTANT_WIDTH_KEY));
    return Number.isFinite(savedWidth) && savedWidth >= 320 ? savedWidth : 410;
  });
  const [topbarPrompt, setTopbarPrompt] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(localStorage.getItem(SIDEBAR_KEY) === 'true');
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(savedWidth) && savedWidth >= 220 && savedWidth <= 420 ? savedWidth : 280;
  });
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
        setNotificationData({ notifications: [], unreadCount: 0, preferences: {} });
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const refreshNotifications = useCallback(async () => {
    if (!token) return;
    setNotificationsLoading(true);
    try {
      setNotificationData(await getNotifications(token));
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message);
      setNotificationData((current) => ({ ...current, notifications: [], unreadCount: 0 }));
    } finally {
      setNotificationsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;

    let interval;
    const startPolling = () => {
      window.clearInterval(interval);
      interval = undefined;

      if (document.visibilityState !== 'visible') return;
      void refreshNotifications();
      interval = window.setInterval(() => {
        if (document.visibilityState === 'visible') void refreshNotifications();
      }, 120000);
    };

    const initial = window.setTimeout(startPolling, 0);
    document.addEventListener('visibilitychange', startPolling);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', startPolling);
    };
  }, [token, dashboardRefreshKey, refreshNotifications]);

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

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(sidebarWidth)));
  }, [sidebarWidth]);

  const handleLogin = useCallback((newToken, loggedInUser) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setCheckingSession(true);
    setUser(loggedInUser);
    setToken(newToken);
  }, []);

  const handleLogout = async () => {
    if (token) await logout(token).catch(() => {});
    portfolioStopRef.current();
    setPortfolioHighlight(null);
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
    setNotificationData({ notifications: [], unreadCount: 0, preferences: {} });
    setAssistantMode('closed');
    setTopbarPrompt('');
    setCheckingSession(false);
    activePageRef.current = 'dashboard';
    setActivePage('dashboard');
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    setPageHistory([]);
  };

  const handleDataChanged = useCallback(() => {
    setDashboardRefreshKey((key) => key + 1);
  }, []);

  const changeNotificationState = async (fingerprint, state) => {
    try {
      setNotificationData(await updateNotificationState(token, fingerprint, state));
      setNotificationError('');
      return true;
    } catch (error) {
      setNotificationError(error.message);
      return false;
    }
  };

  const readAllNotifications = async () => {
    try {
      setNotificationData(await markAllNotificationsRead(token));
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message);
    }
  };

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
    if (DIRECT_HASH_PAGE_IDS.has(pageId)) {
      const url = new URL(window.location.href);
      url.hash = pageId === 'dashboard' ? '' : pageId;
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
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
      if (DIRECT_HASH_PAGE_IDS.has(previousPage)) {
        const url = new URL(window.location.href);
        url.hash = previousPage === 'dashboard' ? '' : previousPage;
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
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

  const resizeSidebar = (clientX) => {
    const maximum = Math.min(420, Math.max(280, window.innerWidth * 0.42));
    setSidebarWidth(Math.min(maximum, Math.max(220, clientX)));
  };

  const handleSidebarResizeStart = (event) => {
    if (sidebarCollapsed || window.matchMedia('(max-width: 980px)').matches) return;
    event.preventDefault();
    document.body.classList.add('is-resizing-sidebar');

    const handlePointerMove = (pointerEvent) => resizeSidebar(pointerEvent.clientX);
    const handlePointerUp = () => {
      document.body.classList.remove('is-resizing-sidebar');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const resizeSidebarWithKeyboard = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') {
      setSidebarWidth(280);
      return;
    }
    setSidebarWidth((current) => Math.min(420, Math.max(
      220,
      current + (event.key === 'ArrowRight' ? 16 : -16),
    )));
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
  const notifications = notificationData.notifications || [];
  const unreadCount = notificationData.unreadCount || 0;
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
          onNavigate={navigateToPage}
          onNotificationsChanged={refreshNotifications}
        />
      )
    : activePage === 'module-status'
      ? <ModuleStatus token={token} health={health} refreshKey={dashboardRefreshKey} />
      : activePage === 'life-log'
        ? <LifeLog token={token} refreshKey={moduleRefreshKey} onEntriesChanged={handleDataChanged} />
      : activePage === 'diary'
        ? <Diary token={token} />
      : activePage === 'reviews'
        ? <Reviews token={token} onNavigate={navigateToPage} />
      : activePage === 'tasks'
        ? <Tasks token={token} refreshKey={moduleRefreshKey} onTasksChanged={handleDataChanged} />
      : activePage === 'finance'
        ? <Finance token={token} refreshKey={moduleRefreshKey} onTransactionsChanged={handleDataChanged} />
      : activePage === 'scheduling'
        ? <Scheduling token={token} refreshKey={moduleRefreshKey} onScheduleChanged={handleDataChanged} onManageGoogleAccounts={() => navigateToPage('settings')} />
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
        ].filter(Boolean).join(' ')} style={{ '--sidebar-width': `${Math.round(sidebarWidth)}px` }}>
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
                <div className={`nav-group nav-group-${group.tone}`} key={group.label}>
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
                        data-label={item.label}
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
            <div
              aria-label="Resize navigation sidebar"
              aria-orientation="vertical"
              aria-valuemax="420"
              aria-valuemin="220"
              aria-valuenow={Math.round(sidebarWidth)}
              className="sidebar-resizer"
              onDoubleClick={() => setSidebarWidth(280)}
              onKeyDown={resizeSidebarWithKeyboard}
              onPointerDown={handleSidebarResizeStart}
              role="separator"
              tabIndex={sidebarCollapsed ? -1 : 0}
              title="Drag to resize navigation · Double-click to reset"
            />
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
                  aria-label="Ask JDHub"
                  onChange={(event) => setTopbarPrompt(event.target.value)}
                  placeholder="Ask JDHub to find something or take an action…"
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
                    {unreadCount > 0 && <span>{unreadCount > 99 ? '99+' : unreadCount}</span>}
                  </button>
                  {notificationsOpen && (
                    <div className="notification-menu">
                      <div className="notification-menu-header">
                        <div><strong>Notifications</strong><small>{unreadCount} unread · {notifications.length} active</small></div>
                        <button
                          className="notification-read-all"
                          disabled={!unreadCount}
                          onClick={readAllNotifications}
                          type="button"
                        ><CheckCheck size={15} />Mark all read</button>
                      </div>
                      {notificationError && <div className="notification-error">{notificationError}</div>}
                      {notificationsLoading && notifications.length === 0 ? (
                        <p className="muted">Checking for alerts…</p>
                      ) : notifications.length === 0 ? (
                        <div className="notification-empty"><CheckCheck size={22} /><strong>You're all caught up</strong><p>No active alerts need your attention.</p></div>
                      ) : (
                        <div className="notification-menu-list">
                          {notifications.map((item) => (
                            <article className={`notification-menu-item ${item.read ? 'is-read' : 'is-unread'} priority-${item.priority}`} key={item.fingerprint}>
                              <button
                                className="notification-main"
                                onClick={async () => {
                                  if (!item.read) await changeNotificationState(item.fingerprint, { read: true });
                                  navigateToPage(item.page);
                                  setNotificationsOpen(false);
                                }}
                                type="button"
                              >
                                <span className="notification-dot" />
                                <span><small>{item.category}</small><strong>{item.title}</strong>
                                <p>{item.detail}</p>
                                <em>{item.action}</em></span>
                              </button>
                              <button
                                aria-label={`Dismiss ${item.title}`}
                                className="notification-dismiss"
                                onClick={() => changeNotificationState(item.fingerprint, { dismissed: true })}
                                type="button"
                              ><X size={15} /></button>
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
                  mode={activePage === 'command-center' ? 'page' : assistantMode === 'integrated' ? 'integrated' : assistantMode === 'floating' ? 'floating' : 'minimized'}
                  onClose={() => setAssistantMode('closed')}
                  onCommandSaved={handleAssistantDataChanged}
                  onExpand={() => setAssistantMode('floating')}
                  onIntegrate={() => setAssistantMode('integrated')}
                  onMinimize={() => setAssistantMode('floating')}
                  onNavigate={navigateToPage}
                  token={token}
                />
                {activePage !== 'command-center' && (
                  <div className="module-surface">
                    <Suspense fallback={<ModuleLoading />}>{currentPage}</Suspense>
                  </div>
                )}
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
  if (shareMatch) {
    return (
      <Suspense fallback={<ModuleLoading />}>
        <PublicShare shareToken={shareMatch[1]} />
      </Suspense>
    );
  }
  return <PrivateApp />;
}
