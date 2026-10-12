const FinanceForecast = require('../models/FinanceForecast');
const GoogleCalendarConnection = require('../models/GoogleCalendarConnection');
const IntegrationRecord = require('../models/IntegrationRecord');
const NotificationState = require('../models/NotificationState');
const Reminder = require('../models/Reminder');
const ScheduleItem = require('../models/ScheduleItem');
const ServerRecord = require('../models/ServerRecord');
const Task = require('../models/Task');
const User = require('../models/User');
const { getCashPosition } = require('./financeCashLedger');
const { serializeForecast } = require('./financeForecastResolver');
const { nextScheduleOccurrence } = require('../utils/scheduleRecurrence');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PREFERENCES = Object.freeze({
  tasks: true,
  schedule: true,
  finance: true,
  connections: true,
  system: true,
});

function preferencesFor(user) {
  const saved = user?.notification_preferences?.toObject?.()
    || user?.notification_preferences
    || {};
  return Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key, fallback]) => [
    key,
    typeof saved[key] === 'boolean' ? saved[key] : fallback,
  ]));
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function notification({ fingerprint, category, priority = 'info', title, detail, action, page, occurredAt }) {
  return {
    fingerprint,
    category,
    priority,
    title,
    detail,
    action,
    page,
    occurredAt: new Date(occurredAt || Date.now()),
  };
}

function priorityRank(priority) {
  return { critical: 0, warning: 1, info: 2 }[priority] ?? 3;
}

async function taskNotifications(userId, now, horizon) {
  const tasks = await Task.find({
    user_id: userId,
    status: { $nin: ['done', 'cancelled'] },
    due_date: { $ne: null, $lte: horizon },
  }).sort({ due_date: 1, priority: -1 }).limit(100).lean();

  return tasks.map((task) => {
    const overdue = new Date(task.due_date) < now;
    return notification({
      fingerprint: `task:${task._id}:due:${dateKey(task.due_date)}`,
      category: 'tasks',
      priority: overdue || task.priority === 'urgent' ? 'critical' : 'warning',
      title: overdue ? `Overdue: ${task.title}` : `Due soon: ${task.title}`,
      detail: overdue ? 'This task is past its due date.' : 'This task is due within the next 24 hours.',
      action: 'Open task',
      page: 'tasks',
      occurredAt: task.due_date,
    });
  });
}

async function scheduleNotifications(userId, now, horizon) {
  const scheduleFloor = new Date(now.getTime() - DAY_MS);
  const [candidates, reminders] = await Promise.all([
    ScheduleItem.find({
      user_id: userId,
      status: 'scheduled',
      $or: [
        { start_at: { $gte: scheduleFloor, $lte: horizon } },
        { recurrence_frequency: { $in: ['weekly', 'monthly', 'yearly'] } },
      ],
    }).sort({ start_at: 1 }).limit(300),
    Reminder.find({
      user_id: userId,
      status: { $in: ['pending', 'snoozed'] },
      remind_at: { $lte: horizon },
    }).sort({ remind_at: 1 }).limit(100).lean(),
  ]);

  const schedule = candidates
    .map((item) => nextScheduleOccurrence(item, scheduleFloor))
    .filter((item) => item && new Date(item.start_at) <= horizon)
    .map((item) => notification({
      fingerprint: `schedule:${item._id}:at:${new Date(item.start_at).toISOString()}`,
      category: 'schedule',
      priority: new Date(item.start_at) < now ? 'warning' : 'info',
      title: item.title,
      detail: new Date(item.start_at) < now ? 'This scheduled item has started.' : 'Scheduled within the next 24 hours.',
      action: 'Open schedule',
      page: 'scheduling',
      occurredAt: item.start_at,
    }));

  const reminderItems = reminders.map((item) => notification({
    fingerprint: `reminder:${item._id}:at:${new Date(item.remind_at).toISOString()}`,
    category: 'schedule',
    priority: new Date(item.remind_at) < now ? 'critical' : 'warning',
    title: item.title,
    detail: new Date(item.remind_at) < now ? 'This reminder is due now.' : 'Reminder coming within 24 hours.',
    action: 'Open Home',
    page: 'dashboard',
    occurredAt: item.remind_at,
  }));

  return [...schedule, ...reminderItems];
}

async function financeNotifications(userId, now) {
  const forecast = await FinanceForecast.findOne({
    user_id: userId,
    archived_at: { $exists: false },
  }).sort({ as_of_date: -1, createdAt: -1 });
  if (!forecast) return [];

  const cash = await getCashPosition(forecast, userId);
  const presented = serializeForecast(forecast, now, cash);
  const dueHorizon = new Date(now.getTime() + 7 * DAY_MS);
  const items = presented.items
    .filter((item) => item.status === 'planned' && new Date(item.date_start) <= dueHorizon)
    .map((item) => notification({
      fingerprint: `finance:${item._id}:due:${dateKey(item.date_start)}`,
      category: 'finance',
      priority: item.resolution_status === 'overdue' || item.projected_balance < 0 ? 'critical' : 'warning',
      title: item.resolution_status === 'overdue' ? `Overdue money item: ${item.label}` : `Upcoming: ${item.label}`,
      detail: item.projected_balance < 0
        ? 'This planned item would make the forecast balance negative.'
        : 'This planned money item is due within seven days.',
      action: 'Open forecast',
      page: 'finance',
      occurredAt: item.date_start,
    }));

  if (Number(cash.current_balance) < 0) {
    items.unshift(notification({
      fingerprint: `finance:negative-cash:${dateKey(now)}`,
      category: 'finance',
      priority: 'critical',
      title: 'Cash balance is below zero',
      detail: 'Review recent transactions and reconcile the finance forecast.',
      action: 'Open Finance',
      page: 'finance',
      occurredAt: now,
    }));
  }
  return items;
}

async function connectionNotifications(userId) {
  const [connection, blockedIntegrations] = await Promise.all([
    GoogleCalendarConnection.findOne({ user_id: userId }).lean(),
    IntegrationRecord.find({
      user_id: userId,
      status: 'blocked',
      archived_at: { $exists: false },
    }).sort({ updatedAt: -1 }).limit(20).lean(),
  ]);
  const google = (connection?.accounts || [])
    .filter((account) => account.last_error)
    .map((account) => notification({
      fingerprint: `google:${account._id}:error:${String(account.last_error).slice(0, 80)}`,
      category: 'connections',
      priority: 'warning',
      title: `Google Calendar needs attention`,
      detail: `${account.account_email}: ${account.last_error}`,
      action: 'Open connections',
      page: 'settings',
      occurredAt: account.updatedAt || connection.updatedAt,
    }));
  const blocked = blockedIntegrations.map((item) => notification({
    fingerprint: `integration:${item._id}:blocked:${dateKey(item.updatedAt)}`,
    category: 'connections',
    priority: 'warning',
    title: `${item.provider} is blocked`,
    detail: item.notes || item.purpose || 'This integration needs attention before it can continue.',
    action: 'Open integrations',
    page: 'integrations',
    occurredAt: item.updatedAt,
  }));
  return [...google, ...blocked];
}

async function systemNotifications(userId) {
  const incidents = await ServerRecord.find({
    user_id: userId,
    record_type: 'incident_log',
    status: { $in: ['active', 'watching'] },
    archived_at: { $exists: false },
  }).sort({ occurred_at: -1, updatedAt: -1 }).limit(30).lean();

  return incidents.map((item) => notification({
    fingerprint: `system:${item._id}:${item.status}:${dateKey(item.updatedAt)}`,
    category: 'system',
    priority: item.status === 'active' ? 'critical' : 'warning',
    title: item.name,
    detail: item.notes || `${item.service || 'Infrastructure'} incident is ${item.status}.`,
    action: 'Open infrastructure',
    page: 'server-manager',
    occurredAt: item.occurred_at || item.updatedAt,
  }));
}

async function listNotifications(userId, now = new Date()) {
  const user = await User.findById(userId).select('notification_preferences');
  const preferences = preferencesFor(user);
  const horizon = new Date(now.getTime() + DAY_MS);
  const groups = await Promise.all([
    preferences.tasks ? taskNotifications(userId, now, horizon) : [],
    preferences.schedule ? scheduleNotifications(userId, now, horizon) : [],
    preferences.finance ? financeNotifications(userId, now) : [],
    preferences.connections ? connectionNotifications(userId) : [],
    preferences.system ? systemNotifications(userId) : [],
  ]);
  const generated = groups.flat();
  const states = await NotificationState.find({
    user_id: userId,
    fingerprint: { $in: generated.map((item) => item.fingerprint) },
  }).lean();
  const stateByFingerprint = new Map(states.map((state) => [state.fingerprint, state]));
  const notifications = generated
    .map((item) => {
      const state = stateByFingerprint.get(item.fingerprint);
      return {
        ...item,
        read: Boolean(state?.read_at),
        dismissed: Boolean(state?.dismissed_at),
      };
    })
    .filter((item) => !item.dismissed)
    .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority)
      || new Date(left.occurredAt) - new Date(right.occurredAt));

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    preferences,
  };
}

module.exports = { DEFAULT_PREFERENCES, listNotifications, preferencesFor };
