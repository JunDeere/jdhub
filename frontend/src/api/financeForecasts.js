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
