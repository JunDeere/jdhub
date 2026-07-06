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

export async function getCommandHistory(token) {
  const response = await fetch(`${API_BASE}/api/commands/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function previewCommand(token, rawText) {
  const response = await fetch(`${API_BASE}/api/commands/preview`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ raw_text: rawText }),
  });
  return parseJson(response);
}

export async function confirmCommand(token, id, payload) {
  const response = await fetch(`${API_BASE}/api/commands/${id}/confirm`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ payload }),
  });
  return parseJson(response);
}

export async function cancelCommand(token, id) {
  const response = await fetch(`${API_BASE}/api/commands/${id}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return parseJson(response);
}
