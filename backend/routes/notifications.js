const express = require('express');
const NotificationState = require('../models/NotificationState');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { DEFAULT_PREFERENCES, listNotifications, preferencesFor } = require('../services/notifications');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    return res.json(await listNotifications(req.userId));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/state', async (req, res) => {
  try {
    const fingerprint = typeof req.body.fingerprint === 'string' ? req.body.fingerprint.trim().slice(0, 500) : '';
    if (!fingerprint) return res.status(400).json({ error: 'Notification fingerprint is required' });
    const update = {};
    if (typeof req.body.read === 'boolean') update.read_at = req.body.read ? new Date() : null;
    if (typeof req.body.dismissed === 'boolean') update.dismissed_at = req.body.dismissed ? new Date() : null;
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Read or dismissed state is required' });

    await NotificationState.findOneAndUpdate(
      { user_id: req.userId, fingerprint },
      { $set: update, $setOnInsert: { user_id: req.userId, fingerprint } },
      { upsert: true, runValidators: true },
    );
    return res.json(await listNotifications(req.userId));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    const current = await listNotifications(req.userId);
    const unread = current.notifications.filter((item) => !item.read);
    if (unread.length) {
      const readAt = new Date();
      await NotificationState.bulkWrite(unread.map((item) => ({
        updateOne: {
          filter: { user_id: req.userId, fingerprint: item.fingerprint },
          update: { $set: { read_at: readAt }, $setOnInsert: { user_id: req.userId, fingerprint: item.fingerprint } },
          upsert: true,
        },
      })));
    }
    return res.json(await listNotifications(req.userId));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/preferences', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('notification_preferences');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ preferences: preferencesFor(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/preferences', async (req, res) => {
  try {
    if (req.isDemo) return res.status(403).json({ error: 'Demo preference changes are disabled' });
    const update = {};
    for (const key of Object.keys(DEFAULT_PREFERENCES)) {
      if (typeof req.body[key] === 'boolean') update[`notification_preferences.${key}`] = req.body[key];
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: 'At least one notification preference is required' });
    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { returnDocument: 'after', runValidators: true })
      .select('notification_preferences');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ preferences: preferencesFor(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
