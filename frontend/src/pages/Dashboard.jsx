import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ClipboardList,
  FileText,
  FolderKanban,
  Eye,
  EyeOff,
  Plug,
  SearchCheck,
  Server,
  Settings,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getDashboard } from '../api/auth.js';
import { formatLocalDate, formatLocalDateTime } from '../utils/dateTime.js';

const ONBOARDING_KEY = 'jdhubDashboardOnboardingOpen';
const METRICS_VISIBILITY_KEY = 'jdhubDashboardMetricsVisible';
const MONEY_VISIBILITY_KEY = 'jdhubDashboardMoneyVisibility';
const BRIEF_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'next-month', label: 'Next month' },
];

function money(value, currency = 'PHP') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getInitialMoneyVisibility() {
  const legacyVisible = localStorage.getItem(METRICS_VISIBILITY_KEY) !== 'false';
  const fallback = { income: legacyVisible, expense: legacyVisible, net: legacyVisible };
  const saved = localStorage.getItem(MONEY_VISIBILITY_KEY);
  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved);
    return {
      income: parsed.income !== false,
      expense: parsed.expense !== false,
      net: parsed.net !== false,
    };
  } catch {
    return fallback;
  }
}

const quickActions = [
  { label: 'Command', detail: 'Create or search', page: 'command-center', icon: SearchCheck, featured: true },
  { label: 'Add note', detail: 'Write now', page: 'life-log', icon: FileText },
  { label: 'Add task', detail: 'Track work', page: 'tasks', icon: ClipboardList },
  { label: 'Add schedule', detail: 'Plan time', page: 'scheduling', icon: CalendarDays },
  { label: 'Money', detail: 'Log cash', page: 'finance', icon: CircleDollarSign },
];

const homeTools = [
  { label: 'Project', page: 'projects', icon: FolderKanban },
  { label: 'Page', page: 'knowledge-base', icon: BookOpen },
  { label: 'Infrastructure', page: 'server-manager', icon: Server, adminOnly: true },
  { label: 'Integrations', page: 'integrations', icon: Plug, adminOnly: true },
  { label: 'Status', page: 'module-status', icon: Activity },
  { label: 'Settings', page: 'settings', icon: Settings },
];

function startOfLocalDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getDefaultBriefId() {
  return new Date().getHours() >= 18 ? 'tomorrow' : 'today';
}

function getBriefWindow(briefId) {
  const now = new Date();
  const today = startOfLocalDay(now);

  if (briefId === 'tomorrow') {
    const start = addDays(today, 1);
    return {
      id: briefId,
      label: 'Tomorrow',
      start,
      end: addDays(start, 1),
    };
  }

  if (briefId === 'week') {
    const start = addDays(today, -((today.getDay() + 6) % 7));
    return {
      id: briefId,
      label: 'This week',
      start,
      end: addDays(start, 7),
    };
  }

  if (briefId === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      id: briefId,
      label: 'This month',
      start,
      end: addMonths(start, 1),
    };
  }

  if (briefId === 'next-month') {
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return {
      id: briefId,
      label: 'Next month',
      start,
      end: addMonths(start, 1),
    };
  }

  return {
    id: 'today',
    label: 'Today',
    start: today,
    end: addDays(today, 1),
  };
}

function isInWindow(value, window, includePastDue = false) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (includePastDue && date < window.start) return true;
  return date >= window.start && date < window.end;
}

function buildBriefSignals(dashboard, briefWindow) {
  if (!dashboard) return [];

  const includePastDue = briefWindow.id === 'today';
  const items = [];

  dashboard.dueTasks?.forEach((task) => {
    if (!isInWindow(task.due_date, briefWindow, includePastDue)) return;

    const dueDate = new Date(task.due_date);
    const overdue = dueDate < briefWindow.start;

    items.push({
      id: `brief-task-${task._id}`,
      title: task.title,
      detail: overdue ? `Overdue since ${formatLocalDate(task.due_date)}.` : `Due ${formatLocalDate(task.due_date)}.`,
      action: 'Open Tasks',
      page: 'tasks',
      when: dueDate.getTime(),
      priority: overdue ? 0 : 1,
    });
  });

  dashboard.upcomingSchedule?.forEach((item) => {
    if (!isInWindow(item.start_at, briefWindow)) return;

    items.push({
      id: `brief-schedule-${item._id}`,
      title: item.title,
      detail: formatLocalDateTime(item.start_at),
      action: 'Open Scheduling',
      page: 'scheduling',
      when: new Date(item.start_at).getTime(),
      priority: 2,
    });
  });

  return items.sort((a, b) => a.priority - b.priority || a.when - b.when);
}

function buildDailyBrief(dashboard, briefWindow, briefSignals) {
  if (!dashboard) {
    return {
      icon: Clock3,
      tone: 'quiet',
      eyebrow: 'Brief',
      title: 'Loading',
      detail: 'Checking tasks, schedule, notes, and system signals.',
      action: 'Open Command Center',
      page: 'command-center',
    };
  }

  const hasAnyRecords = Boolean(
    dashboard.recentEntries?.length ||
    dashboard.openTasks?.length ||
    dashboard.activeProjects?.length ||
    dashboard.recentKnowledgePages?.length ||
    dashboard.upcomingSchedule?.length ||
    dashboard.financeSummary?.income ||
    dashboard.financeSummary?.expense,
  );

  if (briefSignals.length) {
    return {
      icon: AlertTriangle,
      tone: 'warning',
      eyebrow: 'Brief',
      title: briefSignals.length === 1 ? 'One thing needs review' : `${briefSignals.length} things need review`,
      detail: briefSignals[0].detail,
      action: briefSignals[0].action,
      page: briefSignals[0].page,
    };
  }

  if (!hasAnyRecords) {
    return {
      icon: Clock3,
      tone: 'quiet',
      eyebrow: 'Brief',
      title: 'Nothing scheduled',
      detail: 'Start by adding a note, task, schedule item, transaction, or project from quick actions.',
      action: 'Open Command Center',
      page: 'command-center',
    };
  }

  if (dashboard.openTasks?.length) {
    return {
      icon: ClipboardList,
      tone: 'active',
      eyebrow: `${dashboard.openTasks.length} open task${dashboard.openTasks.length === 1 ? '' : 's'}`,
      title: 'Work queue is ready',
      detail: dashboard.openTasks[0].due_date
        ? `${dashboard.openTasks[0].title} is next, due ${formatLocalDate(dashboard.openTasks[0].due_date)}.`
        : `${dashboard.openTasks[0].title} is the next task without a due date.`,
      action: 'Open Tasks',
      page: 'tasks',
    };
  }

  if (dashboard.upcomingSchedule?.length) {
    return {
      icon: CalendarDays,
      tone: 'active',
      eyebrow: 'Next schedule',
      title: dashboard.upcomingSchedule[0].title,
      detail: formatLocalDateTime(dashboard.upcomingSchedule[0].start_at),
      action: 'Open Scheduling',
      page: 'scheduling',
    };
  }

  return {
    icon: CheckCircle2,
    tone: 'clear',
    eyebrow: 'Brief',
    title: 'Clear',
    detail: `No due tasks or schedule items found for ${briefWindow.label.toLowerCase()}. Use quick actions when you want to add the next record.`,
    action: 'Add something',
    page: 'command-center',
  };
}

function buildActivityItems(dashboard) {
  if (!dashboard) return [];

  return [
    dashboard.recentEntries?.[0] && {
      id: `note-${dashboard.recentEntries[0]._id}`,
      label: 'Latest note',
      title: dashboard.recentEntries[0].title,
      detail: formatLocalDateTime(dashboard.recentEntries[0].createdAt),
      page: 'life-log',
    },
    dashboard.openTasks?.[0] && {
      id: `task-${dashboard.openTasks[0]._id}`,
      label: 'Next task',
      title: dashboard.openTasks[0].title,
      detail: dashboard.openTasks[0].due_date ? formatLocalDate(dashboard.openTasks[0].due_date) : 'No due date',
      page: 'tasks',
    },
    dashboard.upcomingSchedule?.[0] && {
      id: `schedule-${dashboard.upcomingSchedule[0]._id}`,
      label: 'Next schedule',
      title: dashboard.upcomingSchedule[0].title,
      detail: formatLocalDateTime(dashboard.upcomingSchedule[0].start_at),
      page: 'scheduling',
    },
    dashboard.activeProjects?.[0] && {
      id: `project-${dashboard.activeProjects[0]._id}`,
      label: 'Active project',
      title: dashboard.activeProjects[0].name,
      detail: `${dashboard.activeProjects[0].priority} priority / ${dashboard.activeProjects[0].status}`,
      page: 'projects',
    },
    dashboard.recentKnowledgePages?.[0] && {
      id: `knowledge-${dashboard.recentKnowledgePages[0]._id}`,
      label: 'Knowledge page',
      title: dashboard.recentKnowledgePages[0].title,
      detail: formatLocalDateTime(dashboard.recentKnowledgePages[0].updatedAt || dashboard.recentKnowledgePages[0].createdAt),
      page: 'knowledge-base',
    },
  ].filter(Boolean);
}

export default function Dashboard({ token, user, refreshKey, onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [onboardingOpen, setOnboardingOpen] = useState(localStorage.getItem(ONBOARDING_KEY) === 'true');
  const [briefId, setBriefId] = useState(getDefaultBriefId);
  const [moneyVisibility, setMoneyVisibility] = useState(getInitialMoneyVisibility);

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

  useEffect(() => {
    localStorage.setItem(MONEY_VISIBILITY_KEY, JSON.stringify(moneyVisibility));
  }, [moneyVisibility]);

  const toggleMoneyVisibility = (metric) => {
    setMoneyVisibility((current) => ({ ...current, [metric]: !current[metric] }));
  };

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
  const briefWindow = getBriefWindow(briefId);
  const briefSignals = buildBriefSignals(dashboard, briefWindow);
  const dailyBrief = buildDailyBrief(dashboard, briefWindow, briefSignals);
  const DailyBriefIcon = dailyBrief.icon;
  const activityItems = buildActivityItems(dashboard);

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Home</p>
          <h2>Home</h2>
        </div>
        <div className="dashboard-heading-actions">
          <span className="status-pill">Protected</span>
        </div>
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

          <div className="home-shortcuts" aria-label="Quick actions">
            <div className="home-shortcuts-header">
              <strong>Quick actions</strong>
              <small>Start here</small>
            </div>
            <div className="quick-action-grid">
              {quickActions.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    className={item.featured ? 'featured' : ''}
                    key={item.page}
                    onClick={() => onNavigate(item.page)}
                    type="button"
                  >
                    <span>
                      <Icon aria-hidden="true" size={20} />
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="home-tool-rail" aria-label="More tools">
              {homeTools.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => {
              const Icon = item.icon;

              return (
                <button key={item.page} onClick={() => onNavigate(item.page)} type="button">
                  <span>
                    <Icon aria-hidden="true" size={18} />
                  </span>
                  <strong>{item.label}</strong>
                </button>
              );
            })}
            </div>
          </div>

          <div className="metric-grid">
            <div className="metric-card money-metric-card">
              <span>Monthly income</span>
              <div className="metric-card-value">
                <strong aria-label={moneyVisibility.income ? undefined : 'Monthly income hidden'}>{moneyVisibility.income ? money(dashboard.financeSummary?.income) : '••••'}</strong>
                <button aria-label={moneyVisibility.income ? 'Hide monthly income' : 'Show monthly income'} aria-pressed={!moneyVisibility.income} className="metric-privacy-toggle" onClick={() => toggleMoneyVisibility('income')} title={moneyVisibility.income ? 'Hide monthly income' : 'Show monthly income'} type="button">
                  {moneyVisibility.income ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
                </button>
              </div>
            </div>
            <div className="metric-card money-metric-card">
              <span>Monthly expense</span>
              <div className="metric-card-value">
                <strong aria-label={moneyVisibility.expense ? undefined : 'Monthly expense hidden'}>{moneyVisibility.expense ? money(dashboard.financeSummary?.expense) : '••••'}</strong>
                <button aria-label={moneyVisibility.expense ? 'Hide monthly expense' : 'Show monthly expense'} aria-pressed={!moneyVisibility.expense} className="metric-privacy-toggle" onClick={() => toggleMoneyVisibility('expense')} title={moneyVisibility.expense ? 'Hide monthly expense' : 'Show monthly expense'} type="button">
                  {moneyVisibility.expense ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
                </button>
              </div>
            </div>
            <div className="metric-card money-metric-card">
              <span>Monthly net</span>
              <div className="metric-card-value">
                <strong aria-label={moneyVisibility.net ? undefined : 'Monthly net hidden'}>{moneyVisibility.net ? money(dashboard.financeSummary?.net) : '••••'}</strong>
                <button aria-label={moneyVisibility.net ? 'Hide monthly net' : 'Show monthly net'} aria-pressed={!moneyVisibility.net} className="metric-privacy-toggle" onClick={() => toggleMoneyVisibility('net')} title={moneyVisibility.net ? 'Hide monthly net' : 'Show monthly net'} type="button">
                  {moneyVisibility.net ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
                </button>
              </div>
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

          <div className={`panel daily-brief ${dailyBrief.tone}`}>
            <div className="daily-brief-main">
              <span className="daily-brief-icon">
                <DailyBriefIcon aria-hidden="true" size={22} />
              </span>
              <div>
                <p className="eyebrow">{dailyBrief.eyebrow}</p>
                <h3>{dailyBrief.title}</h3>
                <p className="muted">{dailyBrief.detail}</p>
              </div>
              <button className="secondary-button" onClick={() => onNavigate(dailyBrief.page)} type="button">
                {dailyBrief.action}
              </button>
            </div>

            <div className="brief-window-control" aria-label="Brief window">
              {BRIEF_OPTIONS.map((option) => (
                <button
                  className={option.id === briefId ? 'selected' : ''}
                  key={option.id}
                  onClick={() => setBriefId(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="daily-brief-body">
              <div className="daily-brief-section">
                <strong>Attention</strong>
                {briefSignals.length ? (
                  <div className="attention-strip">
                    {briefSignals.slice(0, 3).map((item) => (
                      <button key={item.id} onClick={() => onNavigate(item.page)} type="button">
                        <span>{item.title}</span>
                        <small>{item.detail}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No task or schedule signals in this brief. Urgent items still appear in the notification bell.</p>
                )}
              </div>

              <div className="daily-brief-section">
                <strong>Latest movement</strong>
                {activityItems.length ? (
                  <div className="activity-strip">
                    {activityItems.slice(0, 4).map((item) => (
                      <button key={item.id} onClick={() => onNavigate(item.page)} type="button">
                        <small>{item.label}</small>
                        <span>{item.title}</span>
                        <em>{item.detail}</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No records yet. Quick actions are the fastest way to start filling the workspace.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
