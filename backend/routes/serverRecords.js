const express = require('express');
const ServerRecord = require('../models/ServerRecord');
const authMiddleware = require('../middleware/auth');
const { nowUtc, parseOptionalUtcDate } = require('../utils/dateTime');

const router = express.Router();

const validTypes = ['server_note', 'incident_log', 'container_record', 'port_record'];
const validStatuses = ['active', 'planned', 'watching', 'resolved', 'inactive'];

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function parsePort(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined;
}

function recordPayload(body) {
  return {
    record_type: validTypes.includes(body.record_type) ? body.record_type : 'server_note',
    name: typeof body.name === 'string' ? body.name.trim() : '',
    status: validStatuses.includes(body.status) ? body.status : 'active',
    host: typeof body.host === 'string' ? body.host.trim() : '',
    port: parsePort(body.port),
    service: typeof body.service === 'string' ? body.service.trim() : '',
    environment: typeof body.environment === 'string' ? body.environment.trim() : '',
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    occurred_at: parseOptionalUtcDate(body.occurred_at),
    tags: normalizeTags(body.tags),
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.archived === 'true';
    const limit = Math.min(Number(req.query.limit) || 100, 150);
    const filter = { user_id: req.userId };

    if (validTypes.includes(req.query.type)) filter.record_type = req.query.type;
    if (!includeArchived) filter.archived_at = { $exists: false };

    const records = await ServerRecord.find(filter)
      .sort({ record_type: 1, updatedAt: -1 })
      .limit(limit);

    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = recordPayload(req.body);
    if (!payload.name) return res.status(400).json({ error: 'Name is required' });

    const record = await ServerRecord.create({ ...payload, user_id: req.userId });
    res.status(201).json({ record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = recordPayload(req.body);
    if (!payload.name) return res.status(400).json({ error: 'Name is required' });

    const record = await ServerRecord.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      payload,
      { returnDocument: 'after' },
    );

    if (!record) return res.status(404).json({ error: 'Server record not found' });
    res.json({ record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const record = await ServerRecord.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { archived_at: nowUtc() },
      { returnDocument: 'after' },
    );

    if (!record) return res.status(404).json({ error: 'Server record not found' });
    res.json({ record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
