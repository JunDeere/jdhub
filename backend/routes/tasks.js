const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const authMiddleware = require('../middleware/auth');
const { nowUtc, parseOptionalUtcDate } = require('../utils/dateTime');

const router = express.Router();

const validStatuses = ['backlog', 'todo', 'doing', 'blocked', 'done', 'cancelled'];
const validPriorities = ['low', 'medium', 'high', 'urgent'];

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

function taskPayload(body) {
  const status = validStatuses.includes(body.status) ? body.status : 'todo';
  const priority = validPriorities.includes(body.priority) ? body.priority : 'medium';

  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    description: typeof body.description === 'string' ? body.description.trim() : '',
    status,
    priority,
    category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Personal',
    due_date: parseOptionalUtcDate(body.due_date),
    related_project_id: parseObjectId(body.related_project_id),
    tags: normalizeTags(body.tags),
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includeDone = req.query.done === 'true';
    const limit = Math.min(Number(req.query.limit) || 100, 150);
    const filter = { user_id: req.userId };

    if (!includeDone) filter.status = { $nin: ['done', 'cancelled'] };

    const tasks = await Task.find(filter)
      .populate('related_project_id', 'name status')
      .sort({ status: 1, due_date: 1, priority: -1, createdAt: -1 })
      .limit(limit);

    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = taskPayload(req.body);
    if (!payload.title) return res.status(400).json({ error: 'Title is required' });

    const task = await Task.create({
      ...payload,
      user_id: req.userId,
    });

    res.status(201).json({ task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = taskPayload(req.body);
    if (!payload.title) return res.status(400).json({ error: 'Title is required' });

    if (payload.status === 'done') payload.completed_at = nowUtc();
    if (payload.status === 'cancelled') payload.cancelled_at = nowUtc();
    if (!['done', 'cancelled'].includes(payload.status)) {
      payload.completed_at = undefined;
      payload.cancelled_at = undefined;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      payload,
      { returnDocument: 'after' },
    );

    if (!task) return res.status(404).json({ error: 'Task not found' });

    res.json({ task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const status = req.body?.status;
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid task status' });
    }

    const update = { $set: { status }, $unset: {} };
    if (status === 'done') {
      update.$set.completed_at = nowUtc();
      update.$unset.cancelled_at = 1;
    } else if (status === 'cancelled') {
      update.$set.cancelled_at = nowUtc();
      update.$unset.completed_at = 1;
    } else {
      update.$unset.completed_at = 1;
      update.$unset.cancelled_at = 1;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      update,
      { returnDocument: 'after' },
    ).populate('related_project_id', 'name status');

    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json({ task });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/done', async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { status: 'done', completed_at: nowUtc() },
      { returnDocument: 'after' },
    );

    if (!task) return res.status(404).json({ error: 'Task not found' });

    res.json({ task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
