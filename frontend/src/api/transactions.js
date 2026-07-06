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

export async function getTransactions(token) {
  const response = await fetch(`${API_BASE}/api/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createTransaction(token, transaction) {
  const response = await fetch(`${API_BASE}/api/transactions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(transaction),
  });
  return parseJson(response);
}

export async function updateTransaction(token, id, transaction) {
  const response = await fetch(`${API_BASE}/api/transactions/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(transaction),
  });
  return parseJson(response);
}
