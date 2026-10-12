function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function summarizeTransactions(transactions = []) {
  const totals = { income: 0, expense: 0, transfer: 0, net: 0 };
  const categories = new Map();

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount) || 0;
    if (Object.hasOwn(totals, transaction.type)) totals[transaction.type] += amount;
    if (transaction.type === 'expense') {
      const category = transaction.category || 'Uncategorized';
      categories.set(category, (categories.get(category) || 0) + amount);
    }
  });

  totals.income = roundMoney(totals.income);
  totals.expense = roundMoney(totals.expense);
  totals.transfer = roundMoney(totals.transfer);
  totals.net = roundMoney(totals.income - totals.expense);

  return {
    ...totals,
    transaction_count: transactions.length,
    expense_categories: [...categories.entries()]
      .map(([category, amount]) => ({ category, amount: roundMoney(amount) }))
      .sort((left, right) => right.amount - left.amount),
  };
}

function validateReviewRange(periodType, start, end) {
  if (!['daily', 'weekly'].includes(periodType)) return 'Review type must be daily or weekly';
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) {
    return 'A valid review range is required';
  }
  const durationDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (durationDays <= 0 || durationDays > 8) return 'Review range must be between one and eight days';
  if (periodType === 'daily' && durationDays > 1.5) return 'Daily reviews must cover one day';
  if (periodType === 'weekly' && (durationDays < 6 || durationDays > 8)) return 'Weekly reviews must cover seven days';
  return null;
}

function financingDueItems(financing = [], start, end, timeZone = 'UTC') {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  }

  const dueItems = [];
  for (let cursor = start.getTime(); cursor < end.getTime(); cursor += 24 * 60 * 60 * 1000) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(cursor + 6 * 60 * 60 * 1000))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]));
    const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();

    financing.forEach((item) => {
      if (!item.due_day || !item.estimated_monthly) return;
      if ((item.remaining_balance != null && Number(item.remaining_balance) <= 0)
        || (item.installments_remaining != null && Number(item.installments_remaining) <= 0)) return;
      if (item.next_due_date && new Date(cursor) < new Date(item.next_due_date)) return;
      if (parts.day !== Math.min(Number(item.due_day), lastDay)) return;
      dueItems.push({
        _id: item._id,
        title: item.name,
        amount: item.estimated_monthly,
        kind: 'expense',
        date: new Date(cursor),
        overdue: false,
        financing: true,
        provider: item.provider || '',
      });
    });
  }
  return dueItems;
}

module.exports = { financingDueItems, summarizeTransactions, validateReviewRange };
