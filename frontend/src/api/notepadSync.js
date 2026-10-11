const API_BASE = import.meta.env.VITE_API_BASE || '';
const LOCAL_BRIDGE_BASE = import.meta.env.VITE_NOTEPAD_BRIDGE_BASE || 'http://127.0.0.1:38471';

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

export async function retrieveWindowsNotepadNotes() {
  let response;
  try {
    response = await fetch(`${LOCAL_BRIDGE_BASE}/sync`, {
      method: 'POST',
      headers: { 'X-JDHub-Bridge': '1' },
    });
  } catch {
    throw new Error('The desktop Notepad bridge is offline. Start “JDHub Notepad Backup” on this PC, then try again.');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Could not retrieve Windows Notepad notes');
  return body;
}
