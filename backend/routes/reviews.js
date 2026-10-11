const express = require('express');
const FinanceForecast = require('../models/FinanceForecast');
const Reminder = require('../models/Reminder');
const Review = require('../models/Review');
const ScheduleItem = require('../models/ScheduleItem');
const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');
const { financingDueItems, summarizeTransactions, validateReviewRange } = require('../services/reviewSummary');

const router = express.Router();
router.use(authMiddleware);

function cleanText(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function rangeFromRequest(source) {
  const periodType = source.period_type;
  const start = new Date(source.period_start);
  const end = new Date(source.period_end);
  const error = validateReviewRange(periodType, start, end);
  return { periodType, start, end, error };
}

router.get('/', async (req, res) => {
  try {
    const { periodType, start, end, error } = rangeFromRequest(req.query);
    if (error) return res.status(400).json({ error });

    const duration = end.getTime() - start.getTime();
    const upcomingEnd = new Date(end.getTime() + duration);
    const openTaskStatuses = { $nin: ['done', 'cancelled'] };

    const [
      completedTasks,
      completedSchedule,
      unfinishedTasks,
      transactions,
      upcomingSchedule,
      upcomingReminders,
      forecast,
      savedReview,
    ] = await Promise.all([
      Task.find({ user_id: req.userId, status: 'done', completed_at: { $gte: start, $lt: end } })
        .sort({ completed_at: -1 }).limit(50).lean(),
      ScheduleItem.find({ user_id: req.userId, status: 'done', start_at: { $gte: start, $lt: end } })
        .sort({ start_at: -1 }).limit(50).lean(),
      Task.find({ user_id: req.userId, status: openTaskStatuses })
        .sort({ due_date: 1, priority: -1, updatedAt: -1 }).limit(30).lean(),
      Transaction.find({ user_id: req.userId, date: { $gte: start, $lt: end } })
        .sort({ date: -1 }).limit(300).lean(),
      ScheduleItem.find({ user_id: req.userId, status: 'scheduled', start_at: { $gte: end, $lt: upcomingEnd } })
        .sort({ start_at: 1 }).limit(50).lean(),
      Reminder.find({ user_id: req.userId, status: { $in: ['pending', 'snoozed'] }, remind_at: { $gte: end, $lt: upcomingEnd } })
        .sort({ remind_at: 1 }).limit(50).lean(),
      FinanceForecast.findOne({ user_id: req.userId, archived_at: { $exists: false } })
        .sort({ as_of_date: -1, createdAt: -1 }).lean(),
      Review.findOne({ user_id: req.userId, period_type: periodType, period_start: start }).lean(),
    ]);

    const plannedFinance = (forecast?.items || [])
      .filter((item) => item.status === 'planned' && new Date(item.date_start) < upcomingEnd)
      .map((item) => ({
        _id: item._id,
        title: item.label,
        amount: item.amount,
        kind: item.kind,
        date: item.date_start,
        overdue: new Date(item.date_start) < end,
      }))
      .sort((left, right) => new Date(left.date) - new Date(right.date))
      .slice(0, 50);
    const upcomingFinance = [
      ...plannedFinance,
      ...financingDueItems(forecast?.financing || [], end, upcomingEnd, req.query.time_zone),
    ].sort((left, right) => new Date(left.date) - new Date(right.date)).slice(0, 50);

    return res.json({
      period: {
        type: periodType,
        start: start.toISOString(),
        end: end.toISOString(),
        upcoming_end: upcomingEnd.toISOString(),
      },
      completed: {
        tasks: completedTasks,
        schedule: completedSchedule,
        count: completedTasks.length + completedSchedule.length,
      },
      finances: {
        ...summarizeTransactions(transactions),
        transactions: transactions.slice(0, 30),
        currency: forecast?.currency || transactions[0]?.currency || 'PHP',
      },
      unfinished_tasks: unfinishedTasks,
      upcoming: {
        schedule: upcomingSchedule,
        reminders: upcomingReminders,
        finances: upcomingFinance,
        count: upcomingSchedule.length + upcomingReminders.length + upcomingFinance.length,
      },
      review: savedReview,
      privacy: {
        diary_included: false,
        message: 'Diary text stays encrypted in your browser and is never included in review summaries.',
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const { periodType, start, end, error } = rangeFromRequest(req.body);
    if (error) return res.status(400).json({ error });
    const energy = ['', 'low', 'steady', 'high'].includes(req.body.energy) ? req.body.energy : '';
    const review = await Review.findOneAndUpdate(
      { user_id: req.userId, period_type: periodType, period_start: start },
      {
        $set: {
          period_end: end,
          wins: cleanText(req.body.wins),
          reflection: cleanText(req.body.reflection),
          next_focus: cleanText(req.body.next_focus),
          energy,
        },
        $setOnInsert: { user_id: req.userId, period_type: periodType, period_start: start },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    return res.json({ review });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
