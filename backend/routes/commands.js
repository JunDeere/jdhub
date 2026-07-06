const express = require('express');
const CommandAction = require('../models/CommandAction');
const CommandMessage = require('../models/CommandMessage');
const Entry = require('../models/Entry');
const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
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

function titleFromText(text, fallback) {
  const clean = String(text || '').trim();
  if (!clean) return fallback;
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean;
}

function parseExpense(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const amount = Number(words[0]);
  const category = words[1] || 'Other';
  const paymentMethod = words[words.length - 1] || 'Cash';
  const middle = words.slice(2, -1).join(' ');

  return {
    type: 'expense',
    amount: Number.isFinite(amount) ? amount : 0,
    currency: 'PHP',
    category,
    date: new Date().toISOString().slice(0, 10),
    merchant_or_source: middle || category,
    payment_method: paymentMethod,
    note: text.trim(),
    tags: [category].filter(Boolean),
  };
}

function parseCommand(rawText) {
  const text = String(rawText || '').trim();
  const lower = text.toLowerCase();

  if (lower.startsWith('add note:')) {
    const content = text.slice(text.indexOf(':') + 1).trim();
    return {
      command_type: 'add_note',
      action_type: 'create_life_log',
      record_type: 'Entry',
      payload: {
        title: titleFromText(content, 'Command note'),
        content,
        category: 'Command Center',
        tags: ['command-center'],
      },
    };
  }

  if (lower.startsWith('create task:')) {
    const title = text.slice(text.indexOf(':') + 1).trim();
    return {
      command_type: 'create_task',
      action_type: 'create_task',
      record_type: 'Task',
      payload: {
        title,
        description: '',
        status: 'todo',
        priority: 'medium',
        category: 'Personal',
        tags: ['command-center'],
      },
    };
  }

  if (lower.startsWith('log expense:')) {
    const expenseText = text.slice(text.indexOf(':') + 1).trim();
    return {
      command_type: 'log_expense',
      action_type: 'create_transaction',
      record_type: 'Transaction',
      payload: parseExpense(expenseText),
    };
  }

  return {
    command_type: 'unknown',
    action_type: null,
    record_type: null,
    payload: {},
    error: 'Supported commands: add note:, create task:, log expense:',
  };
}

function cleanPayload(actionType, body) {
  if (actionType === 'create_life_log') {
    return {
      title: typeof body.title === 'string' ? body.title.trim() : '',
      content: typeof body.content === 'string' ? body.content.trim() : '',
      category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Command Center',
      tags: normalizeTags(body.tags),
    };
  }

  if (actionType === 'create_task') {
    return {
      title: typeof body.title === 'string' ? body.title.trim() : '',
      description: typeof body.description === 'string' ? body.description.trim() : '',
      status: ['backlog', 'todo', 'doing', 'blocked', 'done', 'cancelled'].includes(body.status) ? body.status : 'todo',
      priority: ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium',
      category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Personal',
      tags: normalizeTags(body.tags),
    };
  }

  if (actionType === 'create_transaction') {
    const amount = Number(body.amount);
    return {
      type: 'expense',
      amount: Number.isFinite(amount) ? amount : 0,
      currency: typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'PHP',
      category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Other',
      date: body.date ? new Date(body.date) : new Date(),
      merchant_or_source: typeof body.merchant_or_source === 'string' ? body.merchant_or_source.trim() : '',
      payment_method: typeof body.payment_method === 'string' ? body.payment_method.trim() : '',
      note: typeof body.note === 'string' ? body.note.trim() : '',
      tags: normalizeTags(body.tags),
    };
  }

  return {};
}

router.use(authMiddleware);

router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const messages = await CommandMessage.find({ user_id: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const rawText = typeof req.body.raw_text === 'string' ? req.body.raw_text.trim() : '';
    if (!rawText) return res.status(400).json({ error: 'Command text is required' });

    const parsed = parseCommand(rawText);
    if (parsed.command_type === 'unknown') {
      return res.status(400).json({ error: parsed.error });
    }

    const message = await CommandMessage.create({
      user_id: req.userId,
      raw_text: rawText,
      command_type: parsed.command_type,
      status: 'previewed',
      preview: {
        action_type: parsed.action_type,
        record_type: parsed.record_type,
        payload: parsed.payload,
      },
    });

    const action = await CommandAction.create({
      user_id: req.userId,
      command_message_id: message._id,
      action_type: parsed.action_type,
      status: 'previewed',
      payload: parsed.payload,
    });

    res.status(201).json({ message, action });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const message = await CommandMessage.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId, status: 'previewed' },
      { status: 'cancelled' },
      { returnDocument: 'after' },
    );

    if (!message) return res.status(404).json({ error: 'Previewed command not found' });

    await CommandAction.updateMany(
      { command_message_id: message._id, user_id: req.userId, status: 'previewed' },
      { status: 'cancelled' },
    );

    res.json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const message = await CommandMessage.findOne({
      _id: req.params.id,
      user_id: req.userId,
      status: 'previewed',
    });

    if (!message) return res.status(404).json({ error: 'Previewed command not found' });

    const action = await CommandAction.findOne({
      command_message_id: message._id,
      user_id: req.userId,
      status: 'previewed',
    });

    if (!action) return res.status(404).json({ error: 'Previewed action not found' });

    const payload = cleanPayload(action.action_type, req.body.payload || action.payload);
    let record;
    let recordType;

    if (action.action_type === 'create_life_log') {
      if (!payload.title || !payload.content) return res.status(400).json({ error: 'Title and content are required' });
      record = await Entry.create({ ...payload, user_id: req.userId, type: 'life_log' });
      recordType = 'Entry';
    } else if (action.action_type === 'create_task') {
      if (!payload.title) return res.status(400).json({ error: 'Task title is required' });
      record = await Task.create({ ...payload, user_id: req.userId });
      recordType = 'Task';
    } else if (action.action_type === 'create_transaction') {
      if (payload.amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });
      record = await Transaction.create({ ...payload, user_id: req.userId });
      recordType = 'Transaction';
    } else {
      return res.status(400).json({ error: 'Unsupported command action' });
    }

    action.status = 'completed';
    action.payload = payload;
    action.result_model = recordType;
    action.result_id = record._id;
    await action.save();

    message.status = 'saved';
    message.preview = { ...message.preview, payload };
    message.saved_record_type = recordType;
    message.saved_record_id = record._id;
    await message.save();

    res.json({ message, action, record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
