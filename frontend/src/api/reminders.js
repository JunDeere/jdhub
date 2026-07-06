const API_BASE = import.meta.env.VITE_API_BASE || '';

function parseJson(response) {
  if (!response.ok) {
    return response.json().then((body) => {
      throw new Error(body.error || 'API request failed');
    });
  }
  return response.json();
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getReminders(token) {
  const response = await fetch(`${API_BASE}/api/reminders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createReminder(token, reminder) {
  const response = await fetch(`${API_BASE}/api/reminders`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(reminder),
  });
  return parseJson(response);
}

export async function updateReminder(token, id, reminder) {
  const response = await fetch(`${API_BASE}/api/reminders/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(reminder),
  });
  return parseJson(response);
}

export async function completeReminder(token, id) {
  const response = await fetch(`${API_BASE}/api/reminders/${id}/complete`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}
