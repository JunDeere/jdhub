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

export async function getServerRecords(token) {
  const response = await fetch(`${API_BASE}/api/server-records`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createServerRecord(token, record) {
  const response = await fetch(`${API_BASE}/api/server-records`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(record),
  });
  return parseJson(response);
}

export async function updateServerRecord(token, id, record) {
  const response = await fetch(`${API_BASE}/api/server-records/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(record),
  });
  return parseJson(response);
}

export async function archiveServerRecord(token, id) {
  const response = await fetch(`${API_BASE}/api/server-records/${id}/archive`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}
