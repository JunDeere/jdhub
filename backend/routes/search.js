const express = require('express');
const Entry = require('../models/Entry');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactText(value, fallback = '') {
  const text = String(value || fallback).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function resultSummary(results) {
  const total = Object.values(results).reduce((sum, items) => sum + items.length, 0);
  const parts = [];

  if (results.entries.length) parts.push(`${results.entries.length} life logs`);
  if (results.knowledge.length) parts.push(`${results.knowledge.length} knowledge pages`);
  if (results.tasks.length) parts.push(`${results.tasks.length} tasks`);
  if (results.projects.length) parts.push(`${results.projects.length} projects`);
  if (results.transactions.length) parts.push(`${results.transactions.length} transactions`);

  return {
    total,
    counts: {
      entries: results.entries.length,
      knowledge: results.knowledge.length,
      tasks: results.tasks.length,
      projects: results.projects.length,
      transactions: results.transactions.length,
    },
    text: total ? `Found ${parts.join(', ')}.` : 'No matching records found.',
  };
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) return res.status(400).json({ error: 'Search query is required' });

    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const regex = new RegExp(escapeRegex(query), 'i');

    const [entries, knowledge, tasks, projects, transactions] = await Promise.all([
      Entry.find({
        user_id: req.userId,
        type: 'life_log',
        archived_at: { $exists: false },
        $or: [{ title: regex }, { content: regex }, { tags: regex }, { category: regex }],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit),
      Entry.find({
        user_id: req.userId,
        type: 'knowledge_page',
        archived_at: { $exists: false },
        $or: [{ title: regex }, { content: regex }, { tags: regex }],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit),
      Task.find({
        user_id: req.userId,
        $or: [{ title: regex }, { description: regex }, { tags: regex }, { category: regex }, { status: regex }],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit),
      Project.find({
        user_id: req.userId,
        status: { $ne: 'archived' },
        $or: [{ name: regex }, { description: regex }, { notes: regex }, { tags: regex }, { status: regex }],
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit),
      Transaction.find({
        user_id: req.userId,
        $or: [
          { category: regex },
          { merchant_or_source: regex },
          { payment_method: regex },
          { note: regex },
          { tags: regex },
          { type: regex },
        ],
      })
        .sort({ date: -1, createdAt: -1 })
        .limit(limit),
    ]);

    const results = {
      entries: entries.map((entry) => ({
        id: entry._id,
        type: 'life_log',
        title: entry.title,
        detail: compactText(entry.content),
        meta: entry.category,
        date: entry.updatedAt,
      })),
      knowledge: knowledge.map((page) => ({
        id: page._id,
        type: 'knowledge_page',
        title: page.title,
        detail: compactText(page.content),
        meta: 'Knowledge Base',
        date: page.updatedAt,
      })),
      tasks: tasks.map((task) => ({
        id: task._id,
        type: 'task',
        title: task.title,
        detail: compactText(task.description, task.category),
        meta: `${task.status} / ${task.priority}`,
        date: task.updatedAt,
      })),
      projects: projects.map((project) => ({
        id: project._id,
        type: 'project',
        title: project.name,
        detail: compactText(project.description || project.notes),
        meta: `${project.status} / ${project.priority}`,
        date: project.updatedAt,
      })),
      transactions: transactions.map((transaction) => ({
        id: transaction._id,
        type: 'transaction',
        title: transaction.merchant_or_source || transaction.note || transaction.category,
        detail: compactText(transaction.note, transaction.payment_method),
        meta: `${transaction.type} / ${transaction.currency} ${transaction.amount}`,
        date: transaction.date,
      })),
    };

    res.json({
      query,
      results,
      summary: resultSummary(results),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
