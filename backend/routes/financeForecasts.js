const express = require('express');
const FinanceForecast = require('../models/FinanceForecast');
const authMiddleware = require('../middleware/auth');
const { resolveForecastMatches, serializeForecast } = require('../services/financeForecastResolver');
const { parseOptionalUtcDate, parseRequiredUtcDate } = require('../utils/dateTime');

const router = express.Router();

router.use(authMiddleware);

function requestError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw requestError(`${label} is required`);
  return text;
}

function requiredAmount(value, label, { allowZero = true } = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw requestError(`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}`);
  }
  return amount;
}

function optionalNumber(value, label, { min = 0, max = Infinity } = {}) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw requestError(`${label} must be between ${min} and ${max === Infinity ? 'a valid number' : max}`);
  }
  return number;
}

function forecastPayload(body) {
  const asOfDate = parseRequiredUtcDate(body.as_of_date);
  if (!asOfDate) throw requestError('Snapshot date is required');
  return {
    name: requiredText(body.name, 'Forecast name'),
    account_name: requiredText(body.account_name, 'Cash account name'),
    currency: requiredText(body.currency, 'Currency').toUpperCase().slice(0, 3),
    as_of_date: asOfDate,
    starting_balance: requiredAmount(body.starting_balance, 'Current cash'),
  };
}

function forecastItemPayload(body) {
  const start = parseRequiredUtcDate(body.date_start);
  const end = parseOptionalUtcDate(body.date_end);
  if (!start) throw requestError('Planned date is required');
  if (end && end < start) throw requestError('End date cannot be before the planned date');
  const kind = ['income', 'expense'].includes(body.kind) ? body.kind : null;
  if (!kind) throw requestError('Item type must be income or expense');
  const status = ['planned', 'completed', 'skipped'].includes(body.status) ? body.status : 'planned';
  return {
    label: requiredText(body.label, 'Item name'),
    kind,
    amount: requiredAmount(body.amount, 'Amount', { allowZero: false }),
    date_start: start,
    date_end: end,
    category: typeof body.category === 'string' ? body.category.trim() : '',
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    is_group: Boolean(body.is_group),
    status,
  };
}

function financingPayload(body) {
  return {
    name: requiredText(body.name, 'Financing name'),
    provider: typeof body.provider === 'string' ? body.provider.trim() : '',
    remaining_balance: optionalNumber(body.remaining_balance, 'Remaining balance'),
    installments_remaining: optionalNumber(body.installments_remaining, 'Payments left'),
    estimated_monthly: optionalNumber(body.estimated_monthly, 'Expected payment'),
    due_day: optionalNumber(body.due_day, 'Due day', { min: 1, max: 31 }),
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
  };
}

async function ownedForecast(req) {
  return FinanceForecast.findOne({
    _id: req.params.forecastId,
    user_id: req.userId,
    archived_at: { $exists: false },
  });
}

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

router.post('/', async (req, res) => {
  try {
    const existing = await FinanceForecast.exists({ user_id: req.userId, archived_at: { $exists: false } });
    if (existing) return res.status(409).json({ error: 'An active forecast already exists' });
    const forecast = await FinanceForecast.create({ ...forecastPayload(req.body), user_id: req.userId });
    res.status(201).json({ forecast: serializeForecast(forecast) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:forecastId', async (req, res) => {
  try {
    const forecast = await ownedForecast(req);
    if (!forecast) return res.status(404).json({ error: 'Forecast not found' });
    Object.assign(forecast, forecastPayload(req.body));
    await forecast.save();
    res.json({ forecast: serializeForecast(forecast) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:forecastId/items', async (req, res) => {
  try {
    const forecast = await ownedForecast(req);
    if (!forecast) return res.status(404).json({ error: 'Forecast not found' });
    forecast.items.push(forecastItemPayload(req.body));
    await forecast.save();
    res.status(201).json({ forecast: serializeForecast(forecast) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:forecastId/items/:itemId', async (req, res) => {
  try {
    const forecast = await ownedForecast(req);
    if (!forecast) return res.status(404).json({ error: 'Forecast not found' });

    const item = forecast.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Forecast item not found' });

    if (Object.keys(req.body).some((key) => key !== 'status')) {
      Object.assign(item, forecastItemPayload(req.body));
    } else if (!['planned', 'completed', 'skipped'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid forecast item status' });
    } else {
      item.status = req.body.status;
    }
    item.resolved_at = req.body.status === 'completed' ? new Date() : undefined;
    item.resolved_by = req.body.status === 'completed' ? 'manual' : undefined;
    item.matched_transaction_id = undefined;
    await forecast.save();
    res.json({ forecast: serializeForecast(forecast) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:forecastId/financing', async (req, res) => {
  try {
    const forecast = await ownedForecast(req);
    if (!forecast) return res.status(404).json({ error: 'Forecast not found' });
    forecast.financing.push(financingPayload(req.body));
    await forecast.save();
    res.status(201).json({ forecast: serializeForecast(forecast) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:forecastId/financing/:itemId', async (req, res) => {
  try {
    const forecast = await ownedForecast(req);
    if (!forecast) return res.status(404).json({ error: 'Forecast not found' });
    const item = forecast.financing.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Financing account not found' });
    Object.assign(item, financingPayload(req.body));
    await forecast.save();
    res.json({ forecast: serializeForecast(forecast) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

module.exports = router;
