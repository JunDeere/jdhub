const express = require('express');
const IntegrationRecord = require('../models/IntegrationRecord');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const validStatuses = ['planned', 'researching', 'ready', 'active', 'paused', 'blocked'];

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function recordPayload(body) {
  return {
    provider: typeof body.provider === 'string' ? body.provider.trim() : '',
    purpose: typeof body.purpose === 'string' ? body.purpose.trim() : '',
    status: validStatuses.includes(body.status) ? body.status : 'planned',
    auth_type: typeof body.auth_type === 'string' ? body.auth_type.trim() : '',
    owner: typeof body.owner === 'string' ? body.owner.trim() : '',
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    tags: normalizeTags(body.tags),
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.archived === 'true';
    const limit = Math.min(Number(req.query.limit) || 100, 150);
    const filter = { user_id: req.userId };

    if (!includeArchived) filter.archived_at = { $exists: false };

    const records = await IntegrationRecord.find(filter)
      .sort({ status: 1, updatedAt: -1 })
      .limit(limit);

    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = recordPayload(req.body);
    if (!payload.provider || !payload.purpose) {
      return res.status(400).json({ error: 'Provider and purpose are required' });
    }

    const record = await IntegrationRecord.create({ ...payload, user_id: req.userId });
    res.status(201).json({ record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = recordPayload(req.body);
    if (!payload.provider || !payload.purpose) {
      return res.status(400).json({ error: 'Provider and purpose are required' });
    }

    const record = await IntegrationRecord.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      payload,
      { returnDocument: 'after' },
    );

    if (!record) return res.status(404).json({ error: 'Integration record not found' });
    res.json({ record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const record = await IntegrationRecord.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { archived_at: new Date() },
      { returnDocument: 'after' },
    );

    if (!record) return res.status(404).json({ error: 'Integration record not found' });
    res.json({ record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
