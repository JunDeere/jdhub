const Entry = require('../models/Entry');
const FinanceForecast = require('../models/FinanceForecast');
const Project = require('../models/Project');
const Reminder = require('../models/Reminder');
const ScheduleItem = require('../models/ScheduleItem');
const Task = require('../models/Task');
const Transaction = require('../models/Transaction');

const STOP_WORDS = new Set([
  'a', 'about', 'all', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'by', 'can',
  'could', 'did', 'do', 'does', 'find', 'for', 'from', 'get', 'give', 'had', 'has',
  'have', 'how', 'i', 'in', 'is', 'it', 'jdhub', 'look', 'me', 'much', 'my', 'of',
  'on', 'or', 'our', 'please', 'record', 'records', 'search', 'show', 'tell', 'that',
  'the', 'these', 'this', 'to', 'was', 'were', 'what', 'when', 'where', 'which',
  'who', 'with', 'would', 'you', 'your',
  'calendar', 'diary', 'entries', 'entry', 'event', 'events', 'file', 'files',
  'finance', 'financial', 'note', 'notes', 'project', 'projects', 'reminder',
  'reminders', 'schedule', 'schedules', 'task', 'tasks', 'transaction', 'transactions',
]);

const PAGE_BY_TYPE = Object.freeze({
  life_log: 'life-log',
  knowledge_page: 'knowledge-base',
  task: 'tasks',
  project: 'projects',
  transaction: 'finance',
  finance_forecast: 'finance',
  schedule: 'scheduling',
  reminder: 'scheduling',
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactText(value, fallback = '', maxLength = 180) {
  const text = String(value || fallback).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function extractSearchTerms(query, maxTerms = 8) {
  const normalized = String(query || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/[^\p{L}\p{N}+#.-]+/gu, ' ')
    .trim();
  if (!normalized) return [];

  const terms = normalized
    .split(/\s+/)
    .map((term) => term.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));

  return [...new Set(terms)].slice(0, maxTerms);
}

function textConditions(fields, regexes) {
  return regexes.flatMap((regex) => fields.map((field) => ({ [field]: regex })));
}

function relevanceScore(result, terms) {
  const title = String(result.title || '').toLocaleLowerCase('en');
  const haystack = `${title} ${result.detail || ''} ${result.meta || ''}`.toLocaleLowerCase('en');
  return terms.reduce((score, term) => {
    if (title === term) return score + 12;
    if (title.startsWith(term)) return score + 7;
    if (title.includes(term)) return score + 5;
    if (haystack.includes(term)) return score + 2;
    return score;
  }, 0);
}

function sortAndLimit(items, terms, limit) {
  return items
    .map((item) => ({ ...item, page: PAGE_BY_TYPE[item.type], _score: relevanceScore(item, terms) }))
    .sort((left, right) => right._score - left._score || new Date(right.date || 0) - new Date(left.date || 0))
    .slice(0, limit)
    .map(({ _score, ...item }) => ({ ...item, relevance: _score }));
}

function resultSummary(results) {
  const labels = {
    entries: 'notes',
    knowledge: 'knowledge pages',
    tasks: 'tasks',
    projects: 'projects',
    transactions: 'transactions',
    forecasts: 'finance forecasts',
    schedule: 'schedule items',
    reminders: 'reminders',
  };
  const counts = Object.fromEntries(Object.entries(results).map(([key, items]) => [key, items.length]));
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const parts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${labels[key]}`);
  return { total, counts, text: total ? `Found ${parts.join(', ')}.` : 'No matching records found.' };
}

function flattenSearchResults(results, limit = 12) {
  return Object.values(results)
    .flat()
    .sort((left, right) => Number(right.relevance || 0) - Number(left.relevance || 0)
      || new Date(right.date || 0) - new Date(left.date || 0))
    .slice(0, limit);
}

async function unifiedSearch(userId, query, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 6, 1), 20);
  const terms = extractSearchTerms(query);
  const emptyResults = {
    entries: [], knowledge: [], tasks: [], projects: [], transactions: [],
    forecasts: [], schedule: [], reminders: [],
  };

  if (!terms.length) {
    return { query: String(query || '').trim(), terms, results: emptyResults, summary: resultSummary(emptyResults) };
  }

  const regexes = terms.map((term) => new RegExp(escapeRegex(term), 'i'));
  const numericValues = terms
    .filter((term) => /^\d+(?:\.\d+)?$/.test(term))
    .map(Number)
    .filter(Number.isFinite);
  const candidateLimit = Math.min(limit * 4, 60);
  const [entries, knowledge, tasks, projects, transactions, forecasts, schedule, reminders] = await Promise.all([
    Entry.find({
      user_id: userId,
      type: 'life_log',
      archived_at: { $exists: false },
      $or: textConditions(['title', 'content', 'tags', 'category'], regexes),
    }).sort({ updatedAt: -1 }).limit(candidateLimit).lean(),
    Entry.find({
      user_id: userId,
      type: 'knowledge_page',
      archived_at: { $exists: false },
      $or: textConditions(['title', 'content', 'tags'], regexes),
    }).sort({ updatedAt: -1 }).limit(candidateLimit).lean(),
    Task.find({
      user_id: userId,
      $or: textConditions(['title', 'description', 'tags', 'category', 'status', 'priority'], regexes),
    }).sort({ updatedAt: -1 }).limit(candidateLimit).lean(),
    Project.find({
      user_id: userId,
      archived_at: { $exists: false },
      status: { $ne: 'archived' },
      $or: textConditions(['name', 'description', 'notes', 'tags', 'status', 'priority'], regexes),
    }).sort({ updatedAt: -1 }).limit(candidateLimit).lean(),
    Transaction.find({
      user_id: userId,
      $or: [
        ...textConditions(['category', 'merchant_or_source', 'payment_method', 'note', 'tags', 'type', 'currency'], regexes),
        ...numericValues.map((amount) => ({ amount })),
      ],
    }).sort({ date: -1, createdAt: -1 }).limit(candidateLimit).lean(),
    FinanceForecast.find({
      user_id: userId,
      archived_at: { $exists: false },
      $or: [
        ...textConditions([
          'name', 'account_name', 'items.label', 'items.category', 'items.notes',
          'financing.name', 'financing.provider', 'financing.notes',
        ], regexes),
        ...numericValues.flatMap((amount) => [
          { starting_balance: amount },
          { 'items.amount': amount },
          { 'financing.remaining_balance': amount },
          { 'financing.estimated_monthly': amount },
        ]),
      ],
    }).sort({ as_of_date: -1, createdAt: -1 }).limit(candidateLimit).lean(),
    ScheduleItem.find({
      user_id: userId,
      $or: textConditions(['title', 'description', 'location', 'status', 'recurrence_frequency'], regexes),
    }).sort({ start_at: -1 }).limit(candidateLimit).lean(),
    Reminder.find({
      user_id: userId,
      $or: textConditions(['title', 'description', 'tags', 'status'], regexes),
    }).sort({ remind_at: -1 }).limit(candidateLimit).lean(),
  ]);

  const results = {
    entries: sortAndLimit(entries.map((entry) => ({
      id: String(entry._id), type: 'life_log', title: entry.title,
      detail: compactText(entry.content), meta: entry.category, date: entry.updatedAt,
    })), terms, limit),
    knowledge: sortAndLimit(knowledge.map((page) => ({
      id: String(page._id), type: 'knowledge_page', title: page.title,
      detail: compactText(page.content), meta: 'Knowledge Base', date: page.updatedAt,
    })), terms, limit),
    tasks: sortAndLimit(tasks.map((task) => ({
      id: String(task._id), type: 'task', title: task.title,
      detail: compactText(task.description, task.category), meta: `${task.status} / ${task.priority}`,
      date: task.updatedAt,
    })), terms, limit),
    projects: sortAndLimit(projects.map((project) => ({
      id: String(project._id), type: 'project', title: project.name,
      detail: compactText(project.description || project.notes), meta: `${project.status} / ${project.priority}`,
      date: project.updatedAt,
    })), terms, limit),
    transactions: sortAndLimit(transactions.map((transaction) => ({
      id: String(transaction._id), type: 'transaction',
      title: transaction.merchant_or_source || transaction.note || transaction.category,
      detail: compactText(transaction.note, transaction.payment_method),
      meta: `${transaction.type} / ${transaction.currency} ${transaction.amount}`,
      date: transaction.date,
    })), terms, limit),
    forecasts: sortAndLimit(forecasts.map((forecast) => ({
      id: String(forecast._id), type: 'finance_forecast', title: forecast.name,
      detail: compactText([
        ...(forecast.items || []).map((item) => `${item.label}: ${item.amount} ${item.notes || ''}`),
        ...(forecast.financing || []).map((item) => `${item.name} ${item.provider || ''}: ${item.remaining_balance ?? ''} ${item.notes || ''}`),
      ].join(' | ')),
      meta: `${forecast.account_name} / ${forecast.currency}`, date: forecast.as_of_date,
    })), terms, limit),
    schedule: sortAndLimit(schedule.map((item) => ({
      id: String(item._id), type: 'schedule', title: item.title,
      detail: compactText(item.description, item.location),
      meta: `${item.status}${item.recurrence_frequency && item.recurrence_frequency !== 'none' ? ` / ${item.recurrence_frequency}` : ''}`,
      date: item.start_at,
    })), terms, limit),
    reminders: sortAndLimit(reminders.map((reminder) => ({
      id: String(reminder._id), type: 'reminder', title: reminder.title,
      detail: compactText(reminder.description), meta: reminder.status, date: reminder.remind_at,
    })), terms, limit),
  };

  return { query: String(query || '').trim(), terms, results, summary: resultSummary(results) };
}

module.exports = {
  extractSearchTerms,
  flattenSearchResults,
  resultSummary,
  unifiedSearch,
  _test: { compactText, relevanceScore, sortAndLimit },
};
