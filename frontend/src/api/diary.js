const API_BASE = import.meta.env.VITE_API_BASE || '';

async function parseJson(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Diary request failed');
  return body;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function getDiary(token) {
  const response = await fetch(`${API_BASE}/api/diary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createDiaryVault(token, vault) {
  const response = await fetch(`${API_BASE}/api/diary/vault`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(vault),
  });
  return parseJson(response);
}

export async function updateDiarySettings(token, settings) {
  const response = await fetch(`${API_BASE}/api/diary/settings`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(settings),
  });
  return parseJson(response);
}

export async function createDiaryEntry(token, entry) {
  const response = await fetch(`${API_BASE}/api/diary/entries`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(entry),
  });
  return parseJson(response);
}

export async function updateDiaryEntry(token, id, entry) {
  const response = await fetch(`${API_BASE}/api/diary/entries/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(entry),
  });
  return parseJson(response);
}

export async function deleteDiaryEntry(token, id) {
  const response = await fetch(`${API_BASE}/api/diary/entries/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}
