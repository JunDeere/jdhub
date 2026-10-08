const API_BASE = import.meta.env.VITE_API_BASE || '';

async function parseJson(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Forecast request failed');
  return body;
}

export async function getFinanceForecast(token) {
  const response = await fetch(`${API_BASE}/api/finance-forecasts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function updateForecastItemStatus(token, forecastId, itemId, status) {
  const response = await fetch(`${API_BASE}/api/finance-forecasts/${forecastId}/items/${itemId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return parseJson(response);
}

async function sendForecastRequest(token, path, method, payload) {
  const response = await fetch(`${API_BASE}/api/finance-forecasts${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export function saveForecast(token, payload, forecastId) {
  return sendForecastRequest(token, forecastId ? `/${forecastId}` : '', forecastId ? 'PATCH' : 'POST', payload);
}

export function saveForecastItem(token, forecastId, payload, itemId) {
  const suffix = itemId ? `/${itemId}` : '';
  return sendForecastRequest(token, `/${forecastId}/items${suffix}`, itemId ? 'PATCH' : 'POST', payload);
}

export function saveFinancingItem(token, forecastId, payload, itemId) {
  const suffix = itemId ? `/${itemId}` : '';
  return sendForecastRequest(token, `/${forecastId}/financing${suffix}`, itemId ? 'PATCH' : 'POST', payload);
}
