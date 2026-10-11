const API_BASE = import.meta.env.VITE_API_BASE || '';

async function parseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Google Calendar request failed');
  return body;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getGoogleCalendarStatus(token) {
  const response = await fetch(`${API_BASE}/api/google-calendar/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function startGoogleCalendarConnection(token) {
  const response = await fetch(`${API_BASE}/api/google-calendar/connect`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJson(response);
}

export async function disconnectGoogleCalendar(token) {
  const response = await fetch(`${API_BASE}/api/google-calendar/disconnect`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJson(response);
}

export async function importGoogleCalendar(token) {
  const response = await fetch(`${API_BASE}/api/google-calendar/import`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJson(response);
}

export async function pushScheduleToGoogle(token) {
  const response = await fetch(`${API_BASE}/api/google-calendar/push`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJson(response);
}
