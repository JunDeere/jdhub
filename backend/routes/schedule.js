const express = require('express');
const ScheduleItem = require('../models/ScheduleItem');
const authMiddleware = require('../middleware/auth');
const { parseRequiredUtcDate } = require('../utils/dateTime');

const router = express.Router();
const statuses = ['scheduled', 'done', 'cancelled'];

function schedulePayload(body) {
  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    description: typeof body.description === 'string' ? body.description.trim() : '',
    start_at: parseRequiredUtcDate(body.start_at),
    end_at: parseRequiredUtcDate(body.end_at),
    location: typeof body.location === 'string' ? body.location.trim() : '',
    status: statuses.includes(body.status) ? body.status : 'scheduled',
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includePast = req.query.past === 'true';
    const filter = { user_id: req.userId };
    if (!includePast) {
      filter.status = { $nin: ['done', 'cancelled'] };
      filter.start_at = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    }

    const scheduleItems = await ScheduleItem.find(filter)
      .sort({ start_at: 1, createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 150));

    res.json({ scheduleItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = schedulePayload(req.body);
    if (!payload.title || !payload.start_at) {
      return res.status(400).json({ error: 'Title and start time are required' });
    }

    const scheduleItem = await ScheduleItem.create({ ...payload, user_id: req.userId });
    res.status(201).json({ scheduleItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = schedulePayload(req.body);
    if (!payload.title || !payload.start_at) {
      return res.status(400).json({ error: 'Title and start time are required' });
    }

    const scheduleItem = await ScheduleItem.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      payload,
      { returnDocument: 'after' },
    );
    if (!scheduleItem) return res.status(404).json({ error: 'Schedule item not found' });

    res.json({ scheduleItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const scheduleItem = await ScheduleItem.findOneAndDelete({
      _id: req.params.id,
      user_id: req.userId,
    });
    if (!scheduleItem) return res.status(404).json({ error: 'Schedule item not found' });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
