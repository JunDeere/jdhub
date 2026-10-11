const API_BASE = import.meta.env.VITE_API_BASE || '';

async function parseJson(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Review request failed');
  return body;
}

export async function getReview(token, period) {
  const query = new URLSearchParams({
    period_type: period.type,
    period_start: period.start.toISOString(),
    period_end: period.end.toISOString(),
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  const response = await fetch(`${API_BASE}/api/reviews?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function saveReview(token, review) {
  const response = await fetch(`${API_BASE}/api/reviews`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(review),
  });
  return parseJson(response);
}
