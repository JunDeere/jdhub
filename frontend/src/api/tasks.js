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
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function getTasks(token) {
  const response = await fetch(`${API_BASE}/api/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createTask(token, task) {
  const response = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(task),
  });
  return parseJson(response);
}

export async function updateTask(token, id, task) {
  const response = await fetch(`${API_BASE}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(task),
  });
  return parseJson(response);
}

export async function markTaskDone(token, id) {
  const response = await fetch(`${API_BASE}/api/tasks/${id}/done`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}
