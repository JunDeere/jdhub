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

export async function getProjects(token) {
  const response = await fetch(`${API_BASE}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createProject(token, project) {
  const response = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(project),
  });
  return parseJson(response);
}

export async function updateProject(token, id, project) {
  const response = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(project),
  });
  return parseJson(response);
}

export async function archiveProject(token, id) {
  const response = await fetch(`${API_BASE}/api/projects/${id}/archive`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}
