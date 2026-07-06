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

export async function getEntries(token) {
  const response = await fetch(`${API_BASE}/api/entries`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createEntry(token, entry) {
  const response = await fetch(`${API_BASE}/api/entries`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(entry),
  });
  return parseJson(response);
}

export async function updateEntry(token, id, entry) {
  const response = await fetch(`${API_BASE}/api/entries/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(entry),
  });
  return parseJson(response);
}

export async function archiveEntry(token, id) {
  const response = await fetch(`${API_BASE}/api/entries/${id}/archive`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  return parseJson(response);
}
