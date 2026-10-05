const express = require('express');
const FinanceForecast = require('../models/FinanceForecast');
const authMiddleware = require('../middleware/auth');
const { resolveForecastMatches, serializeForecast } = require('../services/financeForecastResolver');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const forecast = await FinanceForecast.findOne({
      user_id: req.userId,
      archived_at: { $exists: false },
    }).sort({ as_of_date: -1, createdAt: -1 });

    if (forecast) await resolveForecastMatches(forecast, req.userId);

    res.json({ forecast: serializeForecast(forecast) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:forecastId/items/:itemId', async (req, res) => {
  try {
    const validStatuses = ['planned', 'completed', 'skipped'];
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid forecast item status' });
    }

    const forecast = await FinanceForecast.findOne({
      _id: req.params.forecastId,
      user_id: req.userId,
      archived_at: { $exists: false },
    });
    if (!forecast) return res.status(404).json({ error: 'Forecast not found' });

    const item = forecast.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Forecast item not found' });

    item.status = req.body.status;
    item.resolved_at = req.body.status === 'completed' ? new Date() : undefined;
    item.resolved_by = req.body.status === 'completed' ? 'manual' : undefined;
    item.matched_transaction_id = undefined;
    await forecast.save();
    res.json({ forecast: serializeForecast(forecast) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
