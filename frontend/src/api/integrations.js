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

export async function getIntegrationRecords(token) {
  const response = await fetch(`${API_BASE}/api/integrations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createIntegrationRecord(token, record) {
  const response = await fetch(`${API_BASE}/api/integrations`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(record),
  });
  return parseJson(response);
}

export async function updateIntegrationRecord(token, id, record) {
  const response = await fetch(`${API_BASE}/api/integrations/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(record),
  });
  return parseJson(response);
}

export async function archiveIntegrationRecord(token, id) {
  const response = await fetch(`${API_BASE}/api/integrations/${id}/archive`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}
