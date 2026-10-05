const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const FileItem = require('../models/FileItem');
const FileShare = require('../models/FileShare');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { inspectUpload } = require('../services/fileSecurity');
const { quotaViolation, storageView } = require('../services/fileQuotaPolicy');
const { roleForEmail } = require('../services/siteRoles');

const router = express.Router();
const storageRoot = path.resolve(process.env.FILE_STORAGE_ROOT || path.join(process.cwd(), 'uploads'));
const gigabyte = 1024 ** 3;
const totalQuotaBytes = Math.max(1, Number(process.env.FILE_TOTAL_QUOTA_GB) || 300) * gigabyte;
const userQuotaBytes = Math.max(1, Number(process.env.FILE_USER_QUOTA_GB) || 10) * gigabyte;
let quotaQueue = Promise.resolve();

function cleanName(value, fallback = 'Untitled') {
  const normalized = path.basename(String(value || ''))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[<>:"/\\|?*]/g, '-')
    .trim();
  return normalized.slice(0, 180) || fallback;
}

function userStorageDir(userId) {
  return path.join(storageRoot, 'users', String(userId));
}

function incomingStorageDir(userId) {
  return path.join(storageRoot, '.incoming', String(userId));
}

function withQuotaLock(callback) {
  const next = quotaQueue.then(callback, callback);
  quotaQueue = next.catch(() => {});
  return next;
}

async function storageUsage(userId) {
  const [totalResult, userResult] = await Promise.all([
    FileItem.aggregate([
      { $match: { kind: 'file' } },
      { $group: { _id: null, bytes: { $sum: '$size' } } },
    ]),
    FileItem.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId), kind: 'file' } },
      { $group: { _id: null, bytes: { $sum: '$size' } } },
    ]),
  ]);
  return {
    total: totalResult[0]?.bytes || 0,
    user: userResult[0]?.bytes || 0,
  };
}

async function isAdministrator(userId) {
  const user = await User.findById(userId).select('email role').lean();
  return Boolean(user && (user.role === 'admin' || roleForEmail(user.email) === 'admin'));
}

function storedFilePath(item) {
  const userDir = userStorageDir(item.user_id);
  const target = path.resolve(storageRoot, item.storage_path || '');
  const relative = path.relative(userDir, target);
  if (!item.storage_path || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

async function getFolder(userId, value) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return undefined;
  return FileItem.findOne({ _id: value, user_id: userId, kind: 'folder' });
}

async function getBreadcrumbs(userId, folder) {
  const breadcrumbs = [];
  let current = folder;
  let depth = 0;
  while (current && depth < 20) {
    breadcrumbs.unshift({ _id: current._id, name: current.name });
    current = current.parent_id
      ? await FileItem.findOne({ _id: current.parent_id, user_id: userId, kind: 'folder' })
      : null;
    depth += 1;
  }
  return breadcrumbs;
}

async function collectOwnedTree(userId, rootItem) {
  const items = [rootItem];
  let folderIds = rootItem.kind === 'folder' ? [rootItem._id] : [];
  let depth = 0;
  while (folderIds.length && depth < 50) {
    const children = await FileItem.find({ user_id: userId, parent_id: { $in: folderIds } });
    if (!children.length) break;
    items.push(...children);
    folderIds = children.filter((item) => item.kind === 'folder').map((item) => item._id);
    depth += 1;
  }
  return items;
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      const directory = incomingStorageDir(req.userId);
      fs.mkdir(directory, { recursive: true }, (error) => callback(error, directory));
    },
    filename(req, file, callback) {
      callback(null, crypto.randomUUID());
    },
  }),
  limits: { files: 1 },
});

router.use(authMiddleware);

router.get('/shares', async (req, res) => {
  try {
    await FileShare.deleteMany({ owner_id: req.userId, expires_at: { $lte: new Date() } });
    const shares = await FileShare.find({ owner_id: req.userId })
      .populate('resource_id', 'name kind')
      .sort({ createdAt: -1 });
    return res.json({ shares });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/shares/:shareId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.shareId)) return res.status(400).json({ error: 'Invalid share' });
    const deleted = await FileShare.findOneAndDelete({ _id: req.params.shareId, owner_id: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Share not found' });
    return res.json({ message: 'Share revoked' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const view = ['recent', 'project'].includes(req.query.view) ? req.query.view : 'files';
    const folder = await getFolder(req.userId, req.query.parent_id);
    if (folder === undefined) return res.status(400).json({ error: 'Invalid folder' });
    if (req.query.parent_id && !folder) return res.status(404).json({ error: 'Folder not found' });

    const filter = { user_id: req.userId };
    if (search) {
      filter.$text = { $search: search };
    } else if (view === 'recent') {
      filter.kind = 'file';
    } else if (view === 'project') {
      filter.kind = 'file';
      filter.related_project_id = { $ne: null };
    } else {
      filter.parent_id = folder?._id || null;
    }

    const query = FileItem.find(filter)
      .populate('related_project_id', 'name status')
      .limit(view === 'recent' ? 50 : 250);
    if (view === 'recent') query.sort({ updatedAt: -1 });
    else query.sort({ kind: -1, name: 1, updatedAt: -1 });
    const items = await query;
    const [totals, usage, isAdmin] = await Promise.all([
      FileItem.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(req.userId) } },
        { $group: { _id: '$kind', count: { $sum: 1 }, bytes: { $sum: '$size' } } },
      ]),
      storageUsage(req.userId),
      isAdministrator(req.userId),
    ]);
    const summary = totals.reduce((result, entry) => {
      result[entry._id] = { count: entry.count, bytes: entry.bytes };
      return result;
    }, { file: { count: 0, bytes: 0 }, folder: { count: 0, bytes: 0 } });

    const quota = storageView({
      isAdmin,
      totalUsedBytes: usage.total,
      userUsedBytes: usage.user,
      totalQuotaBytes,
      userQuotaBytes,
    });

    res.json({
      items,
      currentFolder: folder ? { _id: folder._id, name: folder.name } : null,
      breadcrumbs: await getBreadcrumbs(req.userId, folder),
      summary,
      storage: {
        label: 'JDHub Cloud',
        maxSizeMb: null,
        ...quota,
        userQuotaBytes: quota.quotaBytes,
        userUsedBytes: quota.usedBytes,
        securityMode: 'Executable blocking and file-type inspection',
      },
      view,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/folders', express.json(), async (req, res) => {
  try {
    const name = cleanName(req.body.name, 'New folder');
    const parent = await getFolder(req.userId, req.body.parent_id);
    if (parent === undefined) return res.status(400).json({ error: 'Invalid parent folder' });
    if (req.body.parent_id && !parent) return res.status(404).json({ error: 'Parent folder not found' });
    const duplicate = await FileItem.findOne({
      user_id: req.userId,
      parent_id: parent?._id || null,
      kind: 'folder',
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (duplicate) return res.status(409).json({ error: 'A folder with that name already exists here' });

    const item = await FileItem.create({
      user_id: req.userId,
      kind: 'folder',
      name,
      parent_id: parent?._id || null,
    });
    res.status(201).json({ item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/share', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid file or folder' });
    const item = await FileItem.findOne({ _id: req.params.id, user_id: req.userId });
    if (!item) return res.status(404).json({ error: 'File or folder not found' });
    await FileShare.deleteMany({ owner_id: req.userId, resource_id: item._id, expires_at: { $lte: new Date() } });
    const share = await FileShare.findOne({ owner_id: req.userId, resource_id: item._id });
    return res.json({ share: share ? { _id: share._id, expiresAt: share.expires_at } : null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/share', express.json(), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid file or folder' });
    const item = await FileItem.findOne({ _id: req.params.id, user_id: req.userId });
    if (!item) return res.status(404).json({ error: 'File or folder not found' });

    await FileShare.deleteMany({ owner_id: req.userId, resource_id: item._id });
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const share = await FileShare.create({
      owner_id: req.userId,
      resource_id: item._id,
      token_hash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      expires_at: expiresAt,
    });
    const origin = String(process.env.PUBLIC_SHARE_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
    return res.status(201).json({
      share: { _id: share._id, resource: { _id: item._id, name: item.name, kind: item.kind }, expiresAt },
      url: `${origin}/s/${rawToken}`,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });

    try {
      const parent = await getFolder(req.userId, req.body.parent_id);
      if (parent === undefined || (req.body.parent_id && !parent)) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'Upload folder is invalid' });
      }
      const relatedProjectId = req.body.related_project_id;
      if (relatedProjectId && !mongoose.Types.ObjectId.isValid(relatedProjectId)) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'Project selection is invalid' });
      }

      const inspection = await inspectUpload(req.file.path, req.file.originalname);
      if (!inspection.allowed) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(415).json({
          error: `Upload blocked by the file safety check: ${inspection.findings[0]}`,
        });
      }

      const item = await withQuotaLock(async () => {
        const [usage, isAdmin] = await Promise.all([
          storageUsage(req.userId),
          isAdministrator(req.userId),
        ]);
        const violation = quotaViolation({
          isAdmin,
          totalUsedBytes: usage.total,
          userUsedBytes: usage.user,
          uploadBytes: req.file.size,
          totalQuotaBytes,
          userQuotaBytes,
        });
        if (violation) {
          const quotaError = new Error(violation.message);
          quotaError.status = violation.status;
          throw quotaError;
        }

        const directory = userStorageDir(req.userId);
        await fs.promises.mkdir(directory, { recursive: true });
        const finalPath = path.join(directory, req.file.filename);
        await fs.promises.rename(req.file.path, finalPath);

        try {
          return await FileItem.create({
            user_id: req.userId,
            kind: 'file',
            name: cleanName(req.file.originalname, 'file'),
            parent_id: parent?._id || null,
            stored_name: req.file.filename,
            storage_path: path.relative(storageRoot, finalPath),
            mime_type: req.file.mimetype || 'application/octet-stream',
            size: req.file.size,
            sha256: inspection.sha256,
            security_status: inspection.status,
            security_findings: inspection.findings,
            description: typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 500) : '',
            related_project_id: relatedProjectId || null,
          });
        } catch (error) {
          await fs.promises.unlink(finalPath).catch(() => {});
          throw error;
        }
      });
      await item.populate('related_project_id', 'name status');
      return res.status(201).json({ item });
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(error.status || 500).json({ error: error.message });
    }
  });
});

router.patch('/:id', express.json(), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid file or folder' });
    }
    const item = await FileItem.findOne({ _id: req.params.id, user_id: req.userId });
    if (!item) return res.status(404).json({ error: 'File or folder not found' });

    if (typeof req.body.name === 'string') {
      const name = cleanName(req.body.name, item.kind === 'folder' ? 'New folder' : 'file');
      const duplicate = await FileItem.findOne({
        _id: { $ne: item._id },
        user_id: req.userId,
        parent_id: item.parent_id || null,
        kind: item.kind,
        name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (duplicate) return res.status(409).json({ error: `Another ${item.kind} already uses that name here` });
      item.name = name;
    }

    if (item.kind === 'file') {
      if (typeof req.body.description === 'string') {
        item.description = req.body.description.trim().slice(0, 500);
      }
      if (Object.hasOwn(req.body, 'related_project_id')) {
        const relatedProjectId = req.body.related_project_id;
        if (relatedProjectId && !mongoose.Types.ObjectId.isValid(relatedProjectId)) {
          return res.status(400).json({ error: 'Project selection is invalid' });
        }
        item.related_project_id = relatedProjectId || null;
      }
    }

    await item.save();
    await item.populate('related_project_id', 'name status');
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/move', express.json(), async (req, res) => {
  try {
    const ids = [...new Set(Array.isArray(req.body.item_ids) ? req.body.item_ids.map(String) : [])];
    if (!ids.length || ids.length > 100 || ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: 'Select between 1 and 100 valid files or folders' });
    }

    const targetParent = await getFolder(req.userId, req.body.target_parent_id);
    if (targetParent === undefined || (req.body.target_parent_id && !targetParent)) {
      return res.status(404).json({ error: 'Destination folder not found' });
    }

    const items = await FileItem.find({ user_id: req.userId, _id: { $in: ids } });
    if (items.length !== ids.length) return res.status(404).json({ error: 'One or more selected items were not found' });

    const selectedIds = new Set(items.map((item) => String(item._id)));
    let ancestor = targetParent;
    let depth = 0;
    while (ancestor && depth < 50) {
      if (selectedIds.has(String(ancestor._id))) {
        return res.status(400).json({ error: 'A folder cannot be moved into itself or one of its subfolders' });
      }
      ancestor = ancestor.parent_id
        ? await FileItem.findOne({ _id: ancestor.parent_id, user_id: req.userId, kind: 'folder' })
        : null;
      depth += 1;
    }

    const destinationId = targetParent?._id || null;
    const existing = await FileItem.find({
      user_id: req.userId,
      parent_id: destinationId,
      _id: { $nin: ids },
    }).select('kind name').lean();
    const occupiedNames = new Set(existing.map((item) => `${item.kind}:${item.name.toLocaleLowerCase()}`));

    for (const item of items) {
      const key = `${item.kind}:${item.name.toLocaleLowerCase()}`;
      if (occupiedNames.has(key)) {
        return res.status(409).json({ error: `Another ${item.kind} named “${item.name}” already exists there` });
      }
      occupiedNames.add(key);
    }

    await FileItem.updateMany(
      { user_id: req.userId, _id: { $in: ids } },
      { $set: { parent_id: destinationId } },
    );
    return res.json({ movedCount: items.length, target: targetParent ? { _id: targetParent._id, name: targetParent.name } : null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid file or folder' });
    const rootItem = await FileItem.findOne({ _id: req.params.id, user_id: req.userId });
    if (!rootItem) return res.status(404).json({ error: 'File or folder not found' });

    const items = await collectOwnedTree(req.userId, rootItem);
    const ids = items.map((item) => item._id);
    await Promise.all(items.filter((item) => item.kind === 'file').map(async (item) => {
      const filePath = storedFilePath(item);
      if (filePath) await fs.promises.unlink(filePath).catch(() => {});
    }));
    await FileShare.deleteMany({ owner_id: req.userId, resource_id: { $in: ids } });
    await FileItem.deleteMany({ user_id: req.userId, _id: { $in: ids } });
    return res.json({ message: `${rootItem.kind === 'folder' ? 'Folder' : 'File'} deleted`, deletedCount: ids.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const item = await FileItem.findOne({ _id: req.params.id, user_id: req.userId, kind: 'file' });
    if (!item) return res.status(404).json({ error: 'File not found' });
    const filePath = storedFilePath(item);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Stored file is unavailable' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(filePath, cleanName(item.name, 'download'));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
