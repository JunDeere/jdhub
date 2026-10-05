const Transaction = require('../models/Transaction');

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeWords(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function transactionText(transaction) {
  return [
    transaction.merchant_or_source,
    transaction.note,
    transaction.category,
    ...(transaction.tags || []),
  ].join(' ');
}

function textMatches(item, transaction) {
  const expected = new Set(normalizeWords(`${item.label} ${item.category || ''}`));
  const actual = new Set(normalizeWords(transactionText(transaction)));
  return [...expected].some((word) => actual.has(word));
}

function resolutionStatus(item, now = new Date()) {
  if (item.status === 'completed') return 'completed';
  if (item.status === 'skipped') return 'skipped';

  const today = startOfUtcDay(now);
  const dueStart = startOfUtcDay(item.date_start);
  const dueEnd = startOfUtcDay(item.date_end || item.date_start);
  if (dueEnd < today) return 'overdue';
  if (dueStart <= today && dueEnd >= today) return 'due_today';
  return 'upcoming';
}

function serializeForecast(document, now = new Date()) {
  if (!document) return null;

  const forecast = typeof document.toObject === 'function' ? document.toObject() : document;
  let balance = Number(forecast.starting_balance || 0);
  let totalIncome = 0;
  let totalExpense = 0;
  const resolution = { completed: 0, overdue: 0, due_today: 0, upcoming: 0, skipped: 0 };

  forecast.items = [...(forecast.items || [])]
    .sort((left, right) => new Date(left.date_start) - new Date(right.date_start))
    .map((item) => {
      if (item.status !== 'skipped') {
        if (item.kind === 'income') {
          balance += Number(item.amount || 0);
          totalIncome += Number(item.amount || 0);
        } else {
          balance -= Number(item.amount || 0);
          totalExpense += Number(item.amount || 0);
        }
      }

      const resolvedStatus = resolutionStatus(item, now);
      resolution[resolvedStatus] += 1;
      return {
        ...item,
        resolution_status: resolvedStatus,
        projected_balance: Number(balance.toFixed(2)),
      };
    });

  forecast.summary = {
    total_income: Number(totalIncome.toFixed(2)),
    total_expense: Number(totalExpense.toFixed(2)),
    net_change: Number((totalIncome - totalExpense).toFixed(2)),
    ending_balance: Number(balance.toFixed(2)),
  };
  forecast.resolution = resolution;

  return forecast;
}

async function resolveForecastMatches(forecast, userId) {
  if (!forecast?.items?.length) return { matched: 0 };

  const planned = forecast.items.filter((item) => item.status === 'planned');
  if (!planned.length) return { matched: 0 };

  const earliest = new Date(Math.min(...planned.map((item) => new Date(item.date_start).getTime())) - (3 * DAY_MS));
  const latest = new Date(Math.max(...planned.map((item) => new Date(item.date_end || item.date_start).getTime())) + (4 * DAY_MS));
  const transactions = await Transaction.find({
    user_id: userId,
    date: { $gte: earliest, $lt: latest },
  }).sort({ date: 1, createdAt: 1 });
  const usedTransactions = new Set(
    forecast.items
      .map((item) => item.matched_transaction_id?.toString())
      .filter(Boolean),
  );
  let matched = 0;

  for (const item of planned) {
    const windowStart = new Date(startOfUtcDay(item.date_start).getTime() - (3 * DAY_MS));
    const windowEnd = new Date(startOfUtcDay(item.date_end || item.date_start).getTime() + (4 * DAY_MS));
    const candidates = transactions.filter((transaction) => (
      !usedTransactions.has(transaction._id.toString())
      && transaction.type === item.kind
      && Math.abs(Number(transaction.amount) - Number(item.amount)) <= 0.01
      && transaction.date >= windowStart
      && transaction.date < windowEnd
    ));
    const textCandidates = candidates.filter((transaction) => textMatches(item, transaction));
    const selected = textCandidates.length === 1
      ? textCandidates[0]
      : candidates.length === 1 ? candidates[0] : null;

    if (!selected) continue;
    item.status = 'completed';
    item.resolved_at = new Date();
    item.resolved_by = 'transaction';
    item.matched_transaction_id = selected._id;
    usedTransactions.add(selected._id.toString());
    matched += 1;
  }

  if (matched) await forecast.save();
  return { matched };
}

module.exports = { resolveForecastMatches, resolutionStatus, serializeForecast };
