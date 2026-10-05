const API_BASE = import.meta.env.VITE_API_BASE || '';
const DIRECT_UPLOAD_LIMIT = 64 * 1024 * 1024;
const CHUNK_SIZE = 16 * 1024 * 1024;

async function parseJson(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'File request failed');
  }
  return response.json();
}

export async function getFiles(token, { parentId = '', search = '', view = 'files' } = {}) {
  const params = new URLSearchParams();
  if (parentId) params.set('parent_id', parentId);
  if (search.trim()) params.set('search', search.trim());
  if (view !== 'files') params.set('view', view);
  const suffix = params.size ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE}/api/files${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createFolder(token, { name, parentId }) {
  const response = await fetch(`${API_BASE}/api/files/folders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent_id: parentId || null }),
  });
  return parseJson(response);
}

function sendFormData(token, path, body, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE}${path}`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || typeof onProgress !== 'function') return;
      onProgress(event.loaded, event.total);
    });

    request.addEventListener('load', () => {
      let response;
      try {
        response = request.responseText ? JSON.parse(request.responseText) : {};
      } catch {
        reject(new Error('The upload server returned an invalid response'));
        return;
      }
      if (request.status >= 200 && request.status < 300) resolve(response);
      else reject(new Error(response.error || 'File upload failed'));
    });

    request.addEventListener('error', () => reject(new Error(
      'The upload connection was interrupted. JDHub will restart this file when you try again.',
    )));
    request.addEventListener('abort', () => reject(new Error('File upload was cancelled')));
    request.send(body);
  });
}

async function uploadFileInChunks(token, { file, parentId, relatedProjectId, description, onProgress }) {
  const response = await fetch(`${API_BASE}/api/files/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime_type: file.type,
      chunk_size: CHUNK_SIZE,
      parent_id: parentId || null,
      related_project_id: relatedProjectId || null,
      description: description.trim(),
    }),
  });
  const session = await parseJson(response);
  let finalResponse = null;

  for (let index = 0; index < session.totalChunks; index += 1) {
    const start = index * session.chunkSize;
    const end = Math.min(file.size, start + session.chunkSize);
    const body = new FormData();
    body.append('index', String(index));
    body.append('chunk', file.slice(start, end), `${file.name}.part`);
    finalResponse = await sendFormData(
      token,
      `/api/files/uploads/${encodeURIComponent(session.uploadId)}/chunks`,
      body,
      (loaded) => {
        if (typeof onProgress !== 'function') return;
        const overallLoaded = Math.min(file.size, start + Math.min(loaded, end - start));
        onProgress({
          loaded: overallLoaded,
          total: file.size,
          percent: Math.round((overallLoaded / file.size) * 100),
        });
      },
    );
  }
  return finalResponse;
}

export async function uploadFile(token, { file, parentId, relatedProjectId, description, onProgress }) {
  if (file.size > DIRECT_UPLOAD_LIMIT) {
    return uploadFileInChunks(token, {
      file,
      parentId,
      relatedProjectId,
      description,
      onProgress,
    });
  }

  const body = new FormData();
  body.append('file', file);
  if (parentId) body.append('parent_id', parentId);
  if (relatedProjectId) body.append('related_project_id', relatedProjectId);
  if (description.trim()) body.append('description', description.trim());

  return sendFormData(token, '/api/files/upload', body, (loaded, total) => {
    if (typeof onProgress !== 'function') return;
    onProgress({
      loaded,
      total,
      percent: Math.round((loaded / total) * 100),
    });
  });
}

export async function updateFileItem(token, id, payload) {
  const response = await fetch(`${API_BASE}/api/files/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function moveFileItems(token, itemIds, targetParentId) {
  const response = await fetch(`${API_BASE}/api/files/move`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_ids: itemIds, target_parent_id: targetParentId || null }),
  });
  return parseJson(response);
}

export async function deleteFileItem(token, id) {
  const response = await fetch(`${API_BASE}/api/files/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function createFileShare(token, id) {
  const response = await fetch(`${API_BASE}/api/files/${id}/share`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return parseJson(response);
}

export async function getFileShare(token, id) {
  const response = await fetch(`${API_BASE}/api/files/${id}/share`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function revokeFileShare(token, shareId) {
  const response = await fetch(`${API_BASE}/api/files/shares/${shareId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(response);
}

export async function getPublicShare(shareToken, parentId = '') {
  const suffix = parentId ? `?parent_id=${encodeURIComponent(parentId)}` : '';
  const response = await fetch(`${API_BASE}/api/public-shares/${encodeURIComponent(shareToken)}${suffix}`);
  return parseJson(response);
}

export async function downloadPublicShareFile(shareToken, item) {
  const response = await fetch(`${API_BASE}/api/public-shares/${encodeURIComponent(shareToken)}/files/${item._id}/download`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Download failed');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = item.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadPublicShareFolder(shareToken, item) {
  const link = document.createElement('a');
  link.href = `${API_BASE}/api/public-shares/${encodeURIComponent(shareToken)}/folders/${item._id}/download`;
  link.download = `${item.name}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadFile(token, item) {
  const response = await fetch(`${API_BASE}/api/files/${item._id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Download failed');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = item.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
