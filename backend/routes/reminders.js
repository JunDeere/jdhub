const express = require('express');
const Reminder = require('../models/Reminder');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const statuses = ['pending', 'completed', 'snoozed', 'cancelled'];

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function reminderPayload(body) {
  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    description: typeof body.description === 'string' ? body.description.trim() : '',
    remind_at: parseDate(body.remind_at),
    status: statuses.includes(body.status) ? body.status : 'pending',
    tags: normalizeTags(body.tags),
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includeCompleted = req.query.completed === 'true';
    const filter = { user_id: req.userId };
    if (!includeCompleted) filter.status = { $nin: ['completed', 'cancelled'] };

    const reminders = await Reminder.find(filter)
      .sort({ remind_at: 1, createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 150));

    res.json({ reminders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = reminderPayload(req.body);
    if (!payload.title || !payload.remind_at) {
      return res.status(400).json({ error: 'Title and reminder time are required' });
    }

    const reminder = await Reminder.create({ ...payload, user_id: req.userId });
    res.status(201).json({ reminder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = reminderPayload(req.body);
    if (!payload.title || !payload.remind_at) {
      return res.status(400).json({ error: 'Title and reminder time are required' });
    }
    payload.completed_at = payload.status === 'completed' ? new Date() : undefined;

    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      payload,
      { returnDocument: 'after' },
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    res.json({ reminder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/complete', async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { status: 'completed', completed_at: new Date() },
      { returnDocument: 'after' },
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    res.json({ reminder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
