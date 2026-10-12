const API_BASE = import.meta.env.VITE_API_BASE || '';

async function parseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Notification request failed');
  return body;
}

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getNotifications(token) {
  const response = await fetch(`${API_BASE}/api/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function updateNotificationState(token, fingerprint, state) {
  const response = await fetch(`${API_BASE}/api/notifications/state`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ fingerprint, ...state }),
  });
  return parseJson(response);
}

export async function markAllNotificationsRead(token) {
  const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
    method: 'POST',
    headers: headers(token),
  });
  return parseJson(response);
}

export async function getNotificationPreferences(token) {
  const response = await fetch(`${API_BASE}/api/notifications/preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function updateNotificationPreferences(token, preferences) {
  const response = await fetch(`${API_BASE}/api/notifications/preferences`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(preferences),
  });
  return parseJson(response);
}
