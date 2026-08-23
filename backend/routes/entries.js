const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const authMiddleware = require('../middleware/auth');
const { nowUtc } = require('../utils/dateTime');

const router = express.Router();

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}

function parseObjectId(value) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? value : undefined;
}

function entryPayload(body) {
  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    content: typeof body.content === 'string' ? body.content : '',
    category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Personal',
    related_project_id: parseObjectId(body.related_project_id),
    tags: normalizeTags(body.tags),
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.archived === 'true';
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const filter = {
      user_id: req.userId,
      type: 'life_log',
    };

    if (!includeArchived) filter.archived_at = { $exists: false };

    const entries = await Entry.find(filter)
      .populate('related_project_id', 'name status')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = entryPayload(req.body);
    if (!payload.title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const entry = await Entry.create({
      ...payload,
      user_id: req.userId,
      type: 'life_log',
    });

    res.status(201).json({ entry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = entryPayload(req.body);
    if (!payload.title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const entry = await Entry.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      payload,
      { returnDocument: 'after' },
    );

    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    res.json({ entry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const entry = await Entry.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { archived_at: nowUtc() },
      { returnDocument: 'after' },
    );

    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    res.json({ entry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
