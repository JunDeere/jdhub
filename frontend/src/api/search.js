const API_BASE = import.meta.env.VITE_API_BASE || '';

function parseJson(response) {
  if (!response.ok) {
    return response.json().then((body) => {
      throw new Error(body.error || 'API request failed');
    });
  }
  return response.json();
}

export async function globalSearch(token, query) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${API_BASE}/api/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}
