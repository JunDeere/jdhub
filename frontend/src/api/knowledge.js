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

export async function getKnowledgePages(token, search = '') {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE}/api/knowledge${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createKnowledgePage(token, page) {
  const response = await fetch(`${API_BASE}/api/knowledge`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(page),
  });
  return parseJson(response);
}

export async function updateKnowledgePage(token, id, page) {
  const response = await fetch(`${API_BASE}/api/knowledge/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(page),
  });
  return parseJson(response);
}

export async function archiveKnowledgePage(token, id) {
  const response = await fetch(`${API_BASE}/api/knowledge/${id}/archive`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}
