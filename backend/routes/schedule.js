const express = require('express');
const ScheduleItem = require('../models/ScheduleItem');
const authMiddleware = require('../middleware/auth');
const { parseRequiredUtcDate } = require('../utils/dateTime');
const { expandScheduleItems } = require('../utils/scheduleRecurrence');

const router = express.Router();
const statuses = ['scheduled', 'done', 'cancelled'];
const recurrenceFrequencies = ['none', 'weekly', 'monthly', 'yearly'];

function schedulePayload(body) {
  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    description: typeof body.description === 'string' ? body.description.trim() : '',
    start_at: parseRequiredUtcDate(body.start_at),
    end_at: parseRequiredUtcDate(body.end_at),
    location: typeof body.location === 'string' ? body.location.trim() : '',
    status: statuses.includes(body.status) ? body.status : 'scheduled',
    recurrence_frequency: recurrenceFrequencies.includes(body.recurrence_frequency)
      ? body.recurrence_frequency
      : 'none',
    recurrence_until: body.recurrence_frequency && body.recurrence_frequency !== 'none'
      ? parseRequiredUtcDate(body.recurrence_until)
      : null,
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includePast = req.query.past === 'true';
    const rangeStart = req.query.from ? new Date(req.query.from) : null;
    const rangeEnd = req.query.to ? new Date(req.query.to) : null;
    if ((rangeStart && Number.isNaN(rangeStart.getTime())) || (rangeEnd && Number.isNaN(rangeEnd.getTime()))) {
      return res.status(400).json({ error: 'Invalid schedule range' });
    }
    const filter = { user_id: req.userId };
    if (rangeStart && rangeEnd) {
      filter.$or = [
        { recurrence_frequency: { $in: ['weekly', 'monthly', 'yearly'] }, start_at: { $lte: rangeEnd }, $or: [
          { recurrence_until: { $gte: rangeStart } },
          { recurrence_until: { $exists: false } },
          { recurrence_until: null },
        ] },
        { recurrence_frequency: { $in: [null, 'none'] }, start_at: { $gte: rangeStart, $lte: rangeEnd } },
        { recurrence_frequency: { $exists: false }, start_at: { $gte: rangeStart, $lte: rangeEnd } },
      ];
    } else if (!includePast) {
      filter.status = { $nin: ['done', 'cancelled'] };
      filter.start_at = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    }

    const storedItems = await ScheduleItem.find(filter)
      .sort({ start_at: 1, createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 500, 500));
    const scheduleItems = rangeStart && rangeEnd
      ? expandScheduleItems(storedItems, rangeStart, rangeEnd).slice(0, 1000)
      : storedItems;

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
    if (payload.recurrence_until && payload.recurrence_until < payload.start_at) {
      return res.status(400).json({ error: 'Recurrence end date cannot be before the start time' });
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
    if (payload.recurrence_until && payload.recurrence_until < payload.start_at) {
      return res.status(400).json({ error: 'Recurrence end date cannot be before the start time' });
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
