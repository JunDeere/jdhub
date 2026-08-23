function nowUtc() {
  return new Date();
}

function parseUtcDate(value, fallback) {
  if (!value) return fallback;

  const text = String(value).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const date = new Date(dateOnly ? `${text}T00:00:00.000Z` : text);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function parseOptionalUtcDate(value) {
  return parseUtcDate(value, undefined);
}

function parseRequiredUtcDate(value) {
  return parseUtcDate(value, null);
}

function utcMonthRange(value = nowUtc()) {
  const date = parseUtcDate(value, nowUtc());
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

module.exports = {
  nowUtc,
  parseOptionalUtcDate,
  parseRequiredUtcDate,
  utcMonthRange,
};
