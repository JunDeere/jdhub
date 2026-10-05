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

export async function getSchedule(token) {
  const response = await fetch(`${API_BASE}/api/schedule?past=true&limit=150`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createScheduleItem(token, scheduleItem) {
  const response = await fetch(`${API_BASE}/api/schedule`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(scheduleItem),
  });
  return parseJson(response);
}

export async function updateScheduleItem(token, id, scheduleItem) {
  const response = await fetch(`${API_BASE}/api/schedule/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(scheduleItem),
  });
  return parseJson(response);
}

export async function deleteScheduleItem(token, id) {
  const response = await fetch(`${API_BASE}/api/schedule/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return parseJson(response);
}
