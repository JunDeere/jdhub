const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const authMiddleware = require('../middleware/auth');

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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function knowledgePayload(body) {
  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    content: typeof body.content === 'string' ? body.content.trim() : '',
    category: 'Knowledge',
    tags: normalizeTags(body.tags),
    related_project_id: parseObjectId(body.related_project_id),
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.archived === 'true';
    const limit = Math.min(Number(req.query.limit) || 100, 150);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const filter = {
      user_id: req.userId,
      type: 'knowledge_page',
    };

    if (!includeArchived) filter.archived_at = { $exists: false };

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { title: searchRegex },
        { content: searchRegex },
        { tags: searchRegex },
      ];
    }

    const pages = await Entry.find(filter)
      .populate('related_project_id', 'name status')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit);

    res.json({ pages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = knowledgePayload(req.body);
    if (!payload.title || !payload.content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const page = await Entry.create({
      ...payload,
      user_id: req.userId,
      type: 'knowledge_page',
    });

    res.status(201).json({ page });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = knowledgePayload(req.body);
    if (!payload.title || !payload.content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const page = await Entry.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId, type: 'knowledge_page' },
      payload,
      { returnDocument: 'after' },
    ).populate('related_project_id', 'name status');

    if (!page) return res.status(404).json({ error: 'Knowledge page not found' });

    res.json({ page });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const page = await Entry.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId, type: 'knowledge_page' },
      { archived_at: new Date() },
      { returnDocument: 'after' },
    );

    if (!page) return res.status(404).json({ error: 'Knowledge page not found' });

    res.json({ page });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
