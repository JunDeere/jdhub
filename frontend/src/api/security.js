const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Security request failed");
  return body;
}

export const getUsers = (token) =>
  request("/api/security/users", token);

export const updateUserStatus = (token, id, status) =>
  request(`/api/security/users/${id}/status`, token, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const getSecurityOverview = (token) =>
  request("/api/security/overview", token);

export const trustNetwork = (token, data) =>
  request("/api/security/trusted-networks", token, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const removeTrustedNetwork = (token, id) =>
  request(`/api/security/trusted-networks/${id}`, token, { method: "DELETE" });

export const revokeTrustedBrowser = (token, id) =>
  request(`/api/security/trusted-browsers/${id}/revoke`, token, {
    method: "PATCH",
  });

export const createUser = (token, data) =>
  request("/api/security/users", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
