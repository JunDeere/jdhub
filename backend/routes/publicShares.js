const crypto = require('crypto');
const archiver = require('archiver');
const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const FileItem = require('../models/FileItem');
const FileShare = require('../models/FileShare');

const router = express.Router();
const storageRoot = path.resolve(process.env.FILE_STORAGE_ROOT || path.join(process.cwd(), 'uploads'));

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function cleanName(value, fallback = 'download') {
  return path.basename(String(value || fallback)).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || fallback;
}

function storedFilePath(item) {
  const userDir = path.join(storageRoot, 'users', String(item.user_id));
  const target = path.resolve(storageRoot, item.storage_path || '');
  const relative = path.relative(userDir, target);
  if (!item.storage_path || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

async function resolveShare(rawToken) {
  if (!/^[A-Za-z0-9_-]{32,160}$/.test(String(rawToken || ''))) return null;
  const share = await FileShare.findOne({ token_hash: tokenHash(rawToken) });
  if (!share) return null;
  if (share.expires_at <= new Date()) {
    await FileShare.deleteOne({ _id: share._id });
    return null;
  }
  const resource = await FileItem.findOne({ _id: share.resource_id, user_id: share.owner_id });
  if (!resource) {
    await FileShare.deleteOne({ _id: share._id });
    return null;
  }
  return { share, resource };
}

async function isInsideFolder(item, rootFolder) {
  if (String(item._id) === String(rootFolder._id)) return true;
  let parentId = item.parent_id;
  let depth = 0;
  while (parentId && depth < 50) {
    if (String(parentId) === String(rootFolder._id)) return true;
    const parent = await FileItem.findOne({ _id: parentId, user_id: rootFolder.user_id, kind: 'folder' }).select('_id parent_id');
    if (!parent) return false;
    parentId = parent.parent_id;
    depth += 1;
  }
  return false;
}

async function collectFolderFiles(ownerId, rootFolder) {
  const files = [];
  const queue = [{ folder: rootFolder, prefix: '' }];
  let visited = 0;
  while (queue.length && visited < 10000) {
    const { folder, prefix } = queue.shift();
    const children = await FileItem.find({ user_id: ownerId, parent_id: folder._id }).sort({ kind: -1, name: 1 });
    for (const child of children) {
      const safeName = cleanName(child.name, child.kind === 'folder' ? 'Folder' : 'file');
      if (child.kind === 'folder') queue.push({ folder: child, prefix: path.posix.join(prefix, safeName) });
      else files.push({ item: child, archiveName: path.posix.join(prefix, safeName) });
      visited += 1;
      if (visited >= 10000) break;
    }
  }
  return files;
}

router.get('/:token', async (req, res) => {
  try {
    const resolved = await resolveShare(req.params.token);
    if (!resolved) return res.status(404).json({ error: 'This share link is unavailable or has expired' });
    const { share, resource } = resolved;
    if (resource.kind === 'file') {
      return res.json({
        resource: { _id: resource._id, kind: resource.kind, name: resource.name, size: resource.size, mime_type: resource.mime_type },
        items: [],
        expiresAt: share.expires_at,
      });
    }

    let folder = resource;
    if (req.query.parent_id) {
      if (!mongoose.Types.ObjectId.isValid(req.query.parent_id)) return res.status(400).json({ error: 'Invalid folder' });
      const requested = await FileItem.findOne({ _id: req.query.parent_id, user_id: share.owner_id, kind: 'folder' });
      if (!requested || !(await isInsideFolder(requested, resource))) return res.status(404).json({ error: 'Folder not found' });
      folder = requested;
    }

    const items = await FileItem.find({ user_id: share.owner_id, parent_id: folder._id })
      .select('_id kind name size mime_type updatedAt parent_id')
      .sort({ kind: -1, name: 1 });
    return res.json({
      resource: { _id: resource._id, kind: resource.kind, name: resource.name },
      currentFolder: { _id: folder._id, name: folder.name, parent_id: folder.parent_id },
      items,
      expiresAt: share.expires_at,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:token/files/:id/download', async (req, res) => {
  try {
    const resolved = await resolveShare(req.params.token);
    if (!resolved) return res.status(404).json({ error: 'This share link is unavailable or has expired' });
    const { resource } = resolved;
    const item = await FileItem.findOne({ _id: req.params.id, user_id: resource.user_id, kind: 'file' });
    if (!item) return res.status(404).json({ error: 'File not found' });
    const allowed = resource.kind === 'file'
      ? String(item._id) === String(resource._id)
      : await isInsideFolder(item, resource);
    if (!allowed) return res.status(404).json({ error: 'File not found' });
    const filePath = storedFilePath(item);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Stored file is unavailable' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(filePath, cleanName(item.name));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:token/folders/:id/download', async (req, res) => {
  try {
    const resolved = await resolveShare(req.params.token);
    if (!resolved) return res.status(404).json({ error: 'This share link is unavailable or has expired' });
    const { resource } = resolved;
    if (resource.kind !== 'folder') return res.status(404).json({ error: 'Folder not found' });
    const folder = await FileItem.findOne({ _id: req.params.id, user_id: resource.user_id, kind: 'folder' });
    if (!folder || !(await isInsideFolder(folder, resource))) return res.status(404).json({ error: 'Folder not found' });

    const files = await collectFolderFiles(resource.user_id, folder);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') res.destroy(error);
    });
    archive.on('error', (error) => res.destroy(error));
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.attachment(`${cleanName(folder.name, 'Shared folder')}.zip`);
    archive.pipe(res);

    if (!files.length) archive.append('', { name: `${cleanName(folder.name, 'Shared folder')}/` });
    for (const entry of files) {
      const filePath = storedFilePath(entry.item);
      if (filePath && fs.existsSync(filePath)) archive.file(filePath, { name: entry.archiveName });
    }
    await archive.finalize();
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ error: error.message });
    return res.destroy(error);
  }
});

module.exports = router;
