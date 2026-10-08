const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');
const { moveFinancingPayment } = require('../services/financingPayments');
const { nowUtc, parseOptionalUtcDate, utcMonthRange } = require('../utils/dateTime');

const router = express.Router();

const validTypes = ['income', 'expense', 'transfer'];

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}

function transactionPayload(body) {
  const amount = Number(body.amount);
  const financingItemId = body.type === 'expense' && body.financing_item_id
    ? String(body.financing_item_id)
    : null;

  if (financingItemId && !mongoose.isValidObjectId(financingItemId)) {
    const error = new Error('Invalid financing account');
    error.status = 400;
    throw error;
  }

  return {
    type: validTypes.includes(body.type) ? body.type : 'expense',
    amount: Number.isFinite(amount) ? amount : 0,
    currency: typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'PHP',
    category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Uncategorized',
    date: parseOptionalUtcDate(body.date) || nowUtc(),
    merchant_or_source: typeof body.merchant_or_source === 'string' ? body.merchant_or_source.trim() : '',
    payment_method: typeof body.payment_method === 'string' ? body.payment_method.trim() : '',
    note: typeof body.note === 'string' ? body.note.trim() : '',
    financing_item_id: financingItemId,
    is_recurring: Boolean(body.is_recurring),
    tags: normalizeTags(body.tags),
  };
}

async function getMonthlySummary(userId, month) {
  const { start, end } = utcMonthRange(month);
  const rows = await Transaction.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
        date: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
      },
    },
  ]);

  const summary = { income: 0, expense: 0, transfer: 0 };
  rows.forEach((row) => {
    summary[row._id] = row.total;
  });

  return {
    ...summary,
    net: summary.income - summary.expense,
    month: start.toISOString(),
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 150);
    const transactions = await Transaction.find({ user_id: req.userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit);
    const summary = await getMonthlySummary(req.userId, req.query.month);

    res.json({ transactions, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  let transaction;
  try {
    const payload = transactionPayload(req.body);
    if (payload.amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });

    transaction = await Transaction.create({
      ...payload,
      user_id: req.userId,
    });
    await moveFinancingPayment(req.userId, null, payload.financing_item_id ? {
      financingItemId: payload.financing_item_id,
      amount: payload.amount,
    } : null);
    const summary = await getMonthlySummary(req.userId, payload.date);

    res.status(201).json({ transaction, summary });
  } catch (error) {
    if (transaction) await Transaction.deleteOne({ _id: transaction._id }).catch(() => {});
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  let previousPayment = null;
  let nextPayment = null;
  let financingAdjusted = false;
  try {
    const payload = transactionPayload(req.body);
    if (payload.amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });

    const transaction = await Transaction.findOne({ _id: req.params.id, user_id: req.userId });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    previousPayment = transaction.type === 'expense' && transaction.financing_item_id ? {
      financingItemId: transaction.financing_item_id,
      amount: transaction.amount,
    } : null;
    nextPayment = payload.financing_item_id ? {
      financingItemId: payload.financing_item_id,
      amount: payload.amount,
    } : null;
    await moveFinancingPayment(req.userId, previousPayment, nextPayment);
    financingAdjusted = Boolean(previousPayment || nextPayment);

    Object.assign(transaction, payload);
    await transaction.save();

    const summary = await getMonthlySummary(req.userId, payload.date);
    res.json({ transaction, summary });
  } catch (error) {
    if (financingAdjusted) {
      await moveFinancingPayment(req.userId, nextPayment, previousPayment).catch(() => {});
    }
    res.status(error.status || 500).json({ error: error.message });
  }
});

module.exports = { router, getMonthlySummary };
