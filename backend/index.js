const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const commandRoutes = require('./routes/commands');
const entryRoutes = require('./routes/entries');
const integrationRoutes = require('./routes/integrations');
const knowledgeRoutes = require('./routes/knowledge');
const reminderRoutes = require('./routes/reminders');
const scheduleRoutes = require('./routes/schedule');
const searchRoutes = require('./routes/search');
const serverRecordRoutes = require('./routes/serverRecords');
const taskRoutes = require('./routes/tasks');
const projectRoutes = require('./routes/projects');
const { router: transactionRoutes, getMonthlySummary } = require('./routes/transactions');
const authMiddleware = require('./middleware/auth');
const Entry = require('./models/Entry');
const Reminder = require('./models/Reminder');
const ScheduleItem = require('./models/ScheduleItem');
const Task = require('./models/Task');
const Project = require('./models/Project');
const ServerRecord = require('./models/ServerRecord');
const IntegrationRecord = require('./models/IntegrationRecord');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/jdhub')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error', err));

app.get('/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
    time: new Date().toISOString(),
    services: {
      api: 'ok',
      database: databaseConnected ? 'connected' : 'disconnected',
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/server-records', serverRecordRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/transactions', transactionRoutes);

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const recentEntries = await Entry.find({
      user_id: req.userId,
      type: 'life_log',
      archived_at: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .limit(5);
    const openTasks = await Task.find({
      user_id: req.userId,
      status: { $nin: ['done', 'cancelled'] },
    })
      .sort({ due_date: 1, priority: -1, createdAt: -1 })
      .limit(5);
    const taskCounts = await Task.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const taskSummary = taskCounts.reduce((summary, item) => {
      summary[item._id] = item.count;
      return summary;
    }, {});
    const financeSummary = await getMonthlySummary(req.userId);
    const activeProjects = await Project.find({
      user_id: req.userId,
      status: { $nin: ['done', 'archived'] },
    })
      .sort({ priority: -1, updatedAt: -1 })
      .limit(5);
    const recentKnowledgePages = await Entry.find({
      user_id: req.userId,
      type: 'knowledge_page',
      archived_at: { $exists: false },
    })
      .sort({ updatedAt: -1 })
      .limit(5);
    const serverRecordCount = await ServerRecord.countDocuments({
      user_id: req.userId,
      archived_at: { $exists: false },
    });
    const integrationRecordCount = await IntegrationRecord.countDocuments({
      user_id: req.userId,
      archived_at: { $exists: false },
    });
    const upcomingReminders = await Reminder.find({
      user_id: req.userId,
      status: { $nin: ['completed', 'cancelled'] },
      remind_at: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    })
      .sort({ remind_at: 1 })
      .limit(5);
    const upcomingSchedule = await ScheduleItem.find({
      user_id: req.userId,
      status: { $nin: ['done', 'cancelled'] },
      start_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .sort({ start_at: 1 })
      .limit(5);

    res.json({
      message: 'Protected dashboard data',
      userId: req.userId,
      recentEntries,
      openTasks,
      taskSummary,
      financeSummary,
      activeProjects,
      recentKnowledgePages,
      serverRecordCount,
      integrationRecordCount,
      upcomingReminders,
      upcomingSchedule,
      sections: {
        lifeLog: recentEntries.length ? `${recentEntries.length} recent notes` : 'Ready for notes',
        tasks: openTasks.length ? `${openTasks.length} open tasks` : 'Ready for tasks',
        finance: financeSummary.income || financeSummary.expense ? `Net ${financeSummary.net}` : 'Ready for transactions',
        projects: activeProjects.length ? `${activeProjects.length} active projects` : 'Ready for projects',
        knowledgeBase: recentKnowledgePages.length ? `${recentKnowledgePages.length} saved pages` : 'Ready for knowledge pages',
        serverManager: serverRecordCount ? `${serverRecordCount} manual records` : 'Ready for server records',
        integrations: integrationRecordCount ? `${integrationRecordCount} planned integrations` : 'Ready for integration records',
        reminders: upcomingReminders.length ? `${upcomingReminders.length} upcoming` : 'Ready for reminders',
        scheduling: upcomingSchedule.length ? `${upcomingSchedule.length} upcoming` : 'Ready for schedule',
        commandCenter: 'Placeholder only',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => console.log(`Backend listening on ${port}`));
