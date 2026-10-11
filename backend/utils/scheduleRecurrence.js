const frequencies = new Set(['weekly', 'monthly', 'yearly']);

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function occurrenceStart(baseValue, frequency, index) {
  const base = new Date(baseValue);
  if (!index || !frequencies.has(frequency)) return base;
  const next = new Date(base);
  if (frequency === 'weekly') {
    next.setDate(base.getDate() + index * 7);
  } else if (frequency === 'monthly') {
    const targetMonth = base.getMonth() + index;
    const targetYear = base.getFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    next.setFullYear(targetYear, normalizedMonth, 1);
    next.setDate(Math.min(base.getDate(), daysInMonth(targetYear, normalizedMonth)));
  } else if (frequency === 'yearly') {
    const targetYear = base.getFullYear() + index;
    next.setFullYear(targetYear, base.getMonth(), 1);
    next.setDate(Math.min(base.getDate(), daysInMonth(targetYear, base.getMonth())));
  }
  return next;
}

function startingIndex(base, frequency, rangeStart) {
  if (rangeStart <= base) return 0;
  if (frequency === 'weekly') {
    return Math.max(0, Math.floor((rangeStart - base) / (7 * 24 * 60 * 60 * 1000)) - 1);
  }
  if (frequency === 'monthly') {
    return Math.max(0, (rangeStart.getFullYear() - base.getFullYear()) * 12
      + rangeStart.getMonth() - base.getMonth() - 1);
  }
  if (frequency === 'yearly') return Math.max(0, rangeStart.getFullYear() - base.getFullYear() - 1);
  return 0;
}

function recurring(item) {
  return frequencies.has(item.recurrence_frequency);
}

function occurrenceObject(item, start) {
  const raw = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  const originalStart = new Date(item.start_at);
  const duration = item.end_at ? Math.max(0, new Date(item.end_at) - originalStart) : null;
  return {
    ...raw,
    start_at: start,
    end_at: duration === null ? undefined : new Date(start.getTime() + duration),
    occurrence_key: `${item._id}:${start.toISOString()}`,
    series_start_at: originalStart,
    series_end_at: item.end_at,
    is_recurring_occurrence: recurring(item),
  };
}

function expandScheduleItem(item, rangeStartValue, rangeEndValue, maxOccurrences = 500) {
  const rangeStart = new Date(rangeStartValue);
  const rangeEnd = new Date(rangeEndValue);
  const base = new Date(item.start_at);
  if (!recurring(item)) {
    return base >= rangeStart && base <= rangeEnd ? [occurrenceObject(item, base)] : [];
  }

  const until = item.recurrence_until ? new Date(item.recurrence_until) : null;
  const results = [];
  let index = startingIndex(base, item.recurrence_frequency, rangeStart);
  for (let scanned = 0; scanned < maxOccurrences; scanned += 1, index += 1) {
    const start = occurrenceStart(base, item.recurrence_frequency, index);
    if (start > rangeEnd || (until && start > until)) break;
    if (start >= rangeStart) results.push(occurrenceObject(item, start));
  }
  return results;
}

function expandScheduleItems(items, rangeStart, rangeEnd) {
  return items
    .flatMap((item) => expandScheduleItem(item, rangeStart, rangeEnd))
    .sort((left, right) => new Date(left.start_at) - new Date(right.start_at));
}

function nextScheduleOccurrence(item, afterValue) {
  const after = new Date(afterValue);
  const horizon = new Date(after);
  horizon.setFullYear(horizon.getFullYear() + 10);
  return expandScheduleItem(item, after, item.recurrence_until || horizon, 600)[0] || null;
}

module.exports = {
  expandScheduleItem,
  expandScheduleItems,
  nextScheduleOccurrence,
  occurrenceStart,
};
