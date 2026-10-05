const API_BASE = import.meta.env.VITE_API_BASE || '';

function parseJson(response) {
  if (!response.ok) {
    return response.json().then((body) => {
      throw new Error(body.error || 'API request failed');
    });
  }
  return response.json();
}

export async function login({ email, password }) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return parseJson(response);
}

export async function verifyEmailLogin({ challengeId, code, trustBrowser }) {
  const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ challengeId, code, trustBrowser }),
  });
  return parseJson(response);
}

export async function register({ email, password, name }) {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  return parseJson(response);
}

export async function getDashboard(token) {
  const response = await fetch(`${API_BASE}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function getCurrentUser(token) {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function updateCurrentUser(token, { name, phone }) {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, phone }),
  });
  return parseJson(response);
}

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return parseJson(response);
}
