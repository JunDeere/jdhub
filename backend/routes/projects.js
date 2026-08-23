const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Entry = require('../models/Entry');
const authMiddleware = require('../middleware/auth');
const { nowUtc, parseOptionalUtcDate } = require('../utils/dateTime');

const router = express.Router();

const validStatuses = ['backlog', 'active', 'paused', 'blocked', 'done', 'archived'];
const validPriorities = ['low', 'medium', 'high'];

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}

function projectPayload(body) {
  const status = validStatuses.includes(body.status) ? body.status : 'active';
  const priority = validPriorities.includes(body.priority) ? body.priority : 'medium';

  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    description: typeof body.description === 'string' ? body.description.trim() : '',
    status,
    priority,
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    tags: normalizeTags(body.tags),
    start_date: parseOptionalUtcDate(body.start_date),
    target_date: parseOptionalUtcDate(body.target_date),
    archived_at: status === 'archived' ? nowUtc() : undefined,
  };
}

async function attachProjectCounts(projects, userId) {
  const ids = projects.map((project) => project._id);
  if (!ids.length) return projects;

  const [taskCounts, entryCounts] = await Promise.all([
    Task.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId), related_project_id: { $in: ids } } },
      { $group: { _id: '$related_project_id', count: { $sum: 1 } } },
    ]),
    Entry.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          related_project_id: { $in: ids },
          archived_at: { $exists: false },
        },
      },
      { $group: { _id: '$related_project_id', count: { $sum: 1 } } },
    ]),
  ]);

  const tasksByProject = new Map(taskCounts.map((item) => [String(item._id), item.count]));
  const entriesByProject = new Map(entryCounts.map((item) => [String(item._id), item.count]));

  return projects.map((project) => {
    const projectObject = project.toObject();
    projectObject.task_count = tasksByProject.get(String(project._id)) || 0;
    projectObject.entry_count = entriesByProject.get(String(project._id)) || 0;
    return projectObject;
  });
}

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.archived === 'true';
    const limit = Math.min(Number(req.query.limit) || 100, 150);
    const filter = { user_id: req.userId };

    if (!includeArchived) filter.status = { $ne: 'archived' };

    const projects = await Project.find(filter)
      .sort({ status: 1, priority: -1, updatedAt: -1 })
      .limit(limit);

    res.json({ projects: await attachProjectCounts(projects, req.userId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = projectPayload(req.body);
    if (!payload.name) return res.status(400).json({ error: 'Project name is required' });

    const project = await Project.create({
      ...payload,
      user_id: req.userId,
    });

    res.status(201).json({ project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = projectPayload(req.body);
    if (!payload.name) return res.status(400).json({ error: 'Project name is required' });
    if (payload.status !== 'archived') payload.archived_at = undefined;

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      payload,
      { returnDocument: 'after' },
    );

    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/archive', async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { status: 'archived', archived_at: nowUtc() },
      { returnDocument: 'after' },
    );

    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
