const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function getNotepadSyncStatus(token) {
  const response = await fetch(`${API_BASE}/api/notepad-sync/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not load Windows Notepad backup status');
  }
  return response.json();
}
