const bcrypt = require('bcryptjs');
const AssistantMessage = require('../models/AssistantMessage');
const CommandAction = require('../models/CommandAction');
const CommandMessage = require('../models/CommandMessage');
const Entry = require('../models/Entry');
const FinanceForecast = require('../models/FinanceForecast');
const IntegrationRecord = require('../models/IntegrationRecord');
const Project = require('../models/Project');
const Reminder = require('../models/Reminder');
const ScheduleItem = require('../models/ScheduleItem');
const ServerRecord = require('../models/ServerRecord');
const Task = require('../models/Task');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const DEMO_EMAIL = 'demo@demo.com';
const DEMO_PASSWORD = 'demo';

function relativeDate(days, hour = 9, minute = 0) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(hour, minute, 0, 0);
  return value;
}

async function resetDemoData(userId) {
  const owner = { user_id: userId };
  await Promise.all([
    AssistantMessage.deleteMany(owner),
    CommandAction.deleteMany(owner),
    CommandMessage.deleteMany(owner),
    Entry.deleteMany(owner),
    FinanceForecast.deleteMany(owner),
    IntegrationRecord.deleteMany(owner),
    Project.deleteMany(owner),
    Reminder.deleteMany(owner),
    ScheduleItem.deleteMany(owner),
    ServerRecord.deleteMany(owner),
    Task.deleteMany(owner),
    Transaction.deleteMany(owner),
  ]);

  const [websiteProject, homeProject] = await Project.create([
    {
      ...owner,
      name: 'Launch portfolio website',
      description: 'Prepare a small fictional portfolio for launch.',
      status: 'active',
      priority: 'high',
      notes: 'Review the mobile layout and publish the final case study.',
      tags: ['demo', 'website'],
      start_date: relativeDate(-7),
      target_date: relativeDate(14),
    },
    {
      ...owner,
      name: 'Home workspace refresh',
      description: 'Organize the desk and improve the weekly planning setup.',
      status: 'active',
      priority: 'medium',
      tags: ['demo', 'personal'],
      start_date: relativeDate(-3),
      target_date: relativeDate(10),
    },
  ]);

  const [reviewTask, groceryTask, completedTask] = await Task.create([
    {
      ...owner,
      title: 'Review portfolio mobile layout',
      description: 'Check navigation, cards, and the assistant dock on a phone-sized screen.',
      status: 'doing',
      priority: 'high',
      category: 'Work',
      due_date: relativeDate(1, 17),
      related_project_id: websiteProject._id,
      tags: ['demo', 'design'],
    },
    {
      ...owner,
      title: 'Buy groceries for the week',
      description: 'Pick up vegetables, rice, coffee, and breakfast supplies.',
      status: 'todo',
      priority: 'medium',
      category: 'Personal',
      due_date: relativeDate(2, 18),
      related_project_id: homeProject._id,
      tags: ['demo', 'errand'],
    },
    {
      ...owner,
      title: 'Back up project files',
      description: 'Create a verified backup of the demo project folder.',
      status: 'done',
      priority: 'medium',
      category: 'Work',
      due_date: relativeDate(-1, 16),
      completed_at: relativeDate(-1, 15),
      related_project_id: websiteProject._id,
      tags: ['demo', 'backup'],
    },
  ]);

  await Entry.create([
    {
      ...owner,
      type: 'life_log',
      title: 'Productive planning session',
      content: 'Outlined the week, reviewed priorities, and prepared the portfolio launch checklist.',
      category: 'Daily log',
      tags: ['demo', 'planning'],
    },
    {
      ...owner,
      type: 'note',
      title: 'Ideas for a calmer workspace',
      content: 'Use one task list, keep cables labeled, and reserve Friday afternoon for cleanup.',
      category: 'Personal',
      tags: ['demo', 'ideas'],
      related_project_id: homeProject._id,
    },
    {
      ...owner,
      type: 'knowledge_page',
      title: 'Deployment checklist',
      content: 'Run tests, verify environment variables, create a backup, deploy, and confirm health checks.',
      category: 'Engineering',
      tags: ['demo', 'deployment', 'checklist'],
      related_project_id: websiteProject._id,
    },
  ]);

  await ScheduleItem.create([
    {
      ...owner,
      title: 'Portfolio review',
      description: 'Review the launch checklist and mobile layout.',
      start_at: relativeDate(1, 14),
      end_at: relativeDate(1, 15),
      location: 'Online meeting',
      related_project_id: websiteProject._id,
      related_task_id: reviewTask._id,
    },
    {
      ...owner,
      title: 'Weekly planning',
      description: 'Plan tasks, budget, and appointments for the next seven days.',
      start_at: relativeDate(3, 9),
      end_at: relativeDate(3, 10),
      location: 'Home office',
    },
  ]);

  await Reminder.create([
    {
      ...owner,
      title: 'Prepare for portfolio review',
      description: 'Open the mobile checklist before the review meeting.',
      remind_at: relativeDate(1, 13, 30),
      related_task_id: reviewTask._id,
      related_project_id: websiteProject._id,
      tags: ['demo', 'meeting'],
    },
    {
      ...owner,
      title: 'Bring reusable bags',
      remind_at: relativeDate(2, 17, 30),
      related_task_id: groceryTask._id,
      tags: ['demo', 'errand'],
    },
  ]);

  await Transaction.create([
    {
      ...owner,
      type: 'income',
      amount: 32000,
      category: 'Salary',
      date: relativeDate(-10),
      merchant_or_source: 'Demo Company',
      payment_method: 'Bank transfer',
      note: 'Fictional monthly salary sample',
      tags: ['demo'],
    },
    {
      ...owner,
      type: 'expense',
      amount: 2450,
      category: 'Utilities',
      date: relativeDate(-5),
      merchant_or_source: 'Demo Electric',
      payment_method: 'E-wallet',
      note: 'Fictional utility payment',
      tags: ['demo'],
    },
    {
      ...owner,
      type: 'expense',
      amount: 1850,
      category: 'Groceries',
      date: relativeDate(-2),
      merchant_or_source: 'Neighborhood Market',
      payment_method: 'Debit card',
      note: 'Fictional weekly groceries',
      tags: ['demo'],
    },
  ]);

  await FinanceForecast.create({
    ...owner,
    name: 'Demo monthly cash-flow plan',
    account_name: 'Demo Wallet',
    currency: 'PHP',
    as_of_date: relativeDate(0),
    starting_balance: 18500,
    items: [
      { date_start: relativeDate(3), label: 'Salary', kind: 'income', amount: 16000, category: 'Salary' },
      { date_start: relativeDate(5), label: 'Internet bill', kind: 'expense', amount: 1800, category: 'Utilities' },
      { date_start: relativeDate(8), label: 'Groceries', kind: 'expense', amount: 2500, category: 'Food' },
      { date_start: relativeDate(15), label: 'Savings transfer', kind: 'expense', amount: 5000, category: 'Savings' },
    ],
    financing: [
      {
        name: 'Demo laptop installment',
        provider: 'Sample Finance',
        remaining_balance: 18000,
        installments_remaining: 6,
        estimated_monthly: 3000,
        due_day: 15,
        notes: 'Fictional financing record for demonstration only.',
      },
    ],
  });

  await ServerRecord.create([
    {
      ...owner,
      record_type: 'container_record',
      name: 'Demo web application',
      status: 'active',
      host: 'demo-server.local',
      port: 8080,
      service: 'Docker',
      environment: 'Demo',
      notes: 'Fictional healthy container used to demonstrate Server Manager.',
      tags: ['demo', 'docker'],
    },
    {
      ...owner,
      record_type: 'incident_log',
      name: 'Resolved backup warning',
      status: 'resolved',
      host: 'demo-server.local',
      service: 'Backup',
      environment: 'Demo',
      notes: 'A fictional warning resolved after a successful retry.',
      occurred_at: relativeDate(-2),
      tags: ['demo', 'resolved'],
    },
  ]);

  await IntegrationRecord.create([
    {
      ...owner,
      provider: 'Google Calendar',
      purpose: 'Show upcoming events in JDHub',
      status: 'planned',
      auth_type: 'OAuth',
      owner: 'Demo User',
      notes: 'Fictional integration plan; no external account is connected.',
      tags: ['demo', 'calendar'],
    },
    {
      ...owner,
      provider: 'GitHub',
      purpose: 'Track portfolio repository activity',
      status: 'researching',
      auth_type: 'OAuth',
      owner: 'Demo User',
      notes: 'Fictional research record; no token is stored.',
      tags: ['demo', 'development'],
    },
  ]);

  const command = await CommandMessage.create({
    ...owner,
    raw_text: 'create task: Review portfolio mobile layout',
    command_type: 'create_task',
    status: 'saved',
    preview: { title: reviewTask.title, priority: reviewTask.priority },
    saved_record_id: reviewTask._id,
    saved_record_type: 'Task',
  });
  await CommandAction.create({
    ...owner,
    command_message_id: command._id,
    action_type: 'create_task',
    status: 'completed',
    payload: { title: reviewTask.title, priority: reviewTask.priority },
    result_model: 'Task',
    result_id: reviewTask._id,
  });
  await AssistantMessage.create([
    {
      ...owner,
      role: 'user',
      content: 'What needs my attention?',
      message_type: 'chat',
    },
    {
      ...owner,
      role: 'assistant',
      content: 'Your portfolio mobile-layout review is the highest-priority upcoming item. You also have a weekly planning session and a grocery task scheduled.',
      message_type: 'chat',
      model: 'JDHub demo assistant',
    },
  ]);

  return {
    projects: 2,
    tasks: 3,
    entries: 3,
    scheduleItems: 2,
    reminders: 2,
    transactions: 3,
    financeForecasts: 1,
    serverRecords: 2,
    integrations: 2,
    assistantMessages: 2,
  };
}

async function ensureDemoAccount() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    {
      $set: {
        password_hash: passwordHash,
        name: 'JDHub Demo',
        phone: '',
        role: 'member',
        is_demo: true,
      },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );
  const seeded = await resetDemoData(user._id);
  return { user, seeded };
}

module.exports = {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  ensureDemoAccount,
  resetDemoData,
};
