const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const capabilities = [
  {
    module: 'dashboard',
    tools: [
      { name: 'get_dashboard_summary', method: 'GET', path: '/api/dashboard', status: 'ready' },
    ],
  },
  {
    module: 'notes',
    tools: [
      { name: 'list_notes', method: 'GET', path: '/api/entries', status: 'ready' },
      { name: 'create_note', method: 'POST', path: '/api/entries', status: 'ready' },
      { name: 'update_note', method: 'PATCH', path: '/api/entries/:id', status: 'ready' },
      { name: 'archive_note', method: 'PATCH', path: '/api/entries/:id/archive', status: 'ready' },
    ],
  },
  {
    module: 'tasks',
    tools: [
      { name: 'list_tasks', method: 'GET', path: '/api/tasks', status: 'ready' },
      { name: 'create_task', method: 'POST', path: '/api/tasks', status: 'ready' },
      { name: 'update_task', method: 'PATCH', path: '/api/tasks/:id', status: 'ready' },
      { name: 'mark_task_done', method: 'PATCH', path: '/api/tasks/:id/done', status: 'ready' },
    ],
  },
  {
    module: 'attention_signals',
    tools: [
      { name: 'list_attention_signals', method: 'GET', path: '/api/dashboard', status: 'ready' },
      { name: 'list_due_tasks', method: 'GET', path: '/api/tasks', status: 'ready' },
      { name: 'list_today_schedule', method: 'GET', path: '/api/schedule', status: 'ready' },
      { name: 'list_explicit_reminders', method: 'GET', path: '/api/reminders', status: 'internal' },
      { name: 'complete_explicit_reminder', method: 'PATCH', path: '/api/reminders/:id/complete', status: 'internal' },
    ],
  },
  {
    module: 'scheduling',
    tools: [
      { name: 'list_schedule_items', method: 'GET', path: '/api/schedule', status: 'ready' },
      { name: 'create_schedule_item', method: 'POST', path: '/api/schedule', status: 'ready' },
      { name: 'update_schedule_item', method: 'PATCH', path: '/api/schedule/:id', status: 'ready' },
    ],
  },
  {
    module: 'finance',
    tools: [
      { name: 'list_transactions', method: 'GET', path: '/api/transactions', status: 'ready' },
      { name: 'create_transaction', method: 'POST', path: '/api/transactions', status: 'ready' },
      { name: 'update_transaction', method: 'PATCH', path: '/api/transactions/:id', status: 'ready' },
      { name: 'get_monthly_finance_summary', method: 'GET', path: '/api/transactions/summary/monthly', status: 'ready' },
    ],
  },
  {
    module: 'projects',
    tools: [
      { name: 'list_projects', method: 'GET', path: '/api/projects', status: 'ready' },
      { name: 'create_project', method: 'POST', path: '/api/projects', status: 'ready' },
      { name: 'update_project', method: 'PATCH', path: '/api/projects/:id', status: 'ready' },
      { name: 'archive_project', method: 'PATCH', path: '/api/projects/:id/archive', status: 'ready' },
    ],
  },
  {
    module: 'knowledge_base',
    tools: [
      { name: 'list_knowledge_pages', method: 'GET', path: '/api/knowledge', status: 'ready' },
      { name: 'create_knowledge_page', method: 'POST', path: '/api/knowledge', status: 'ready' },
      { name: 'update_knowledge_page', method: 'PATCH', path: '/api/knowledge/:id', status: 'ready' },
      { name: 'archive_knowledge_page', method: 'PATCH', path: '/api/knowledge/:id/archive', status: 'ready' },
    ],
  },
  {
    module: 'command_center',
    tools: [
      { name: 'list_command_history', method: 'GET', path: '/api/commands', status: 'ready' },
      { name: 'preview_command', method: 'POST', path: '/api/commands/preview', status: 'ready' },
      { name: 'confirm_command', method: 'POST', path: '/api/commands/:id/confirm', status: 'ready' },
      { name: 'cancel_command', method: 'POST', path: '/api/commands/:id/cancel', status: 'ready' },
      { name: 'search_jdhub', method: 'GET', path: '/api/search', status: 'ready' },
    ],
  },
  {
    module: 'server_manager',
    tools: [
      { name: 'list_server_records', method: 'GET', path: '/api/server-records', status: 'ready' },
      { name: 'create_server_record', method: 'POST', path: '/api/server-records', status: 'ready' },
      { name: 'update_server_record', method: 'PATCH', path: '/api/server-records/:id', status: 'ready' },
      { name: 'archive_server_record', method: 'PATCH', path: '/api/server-records/:id/archive', status: 'ready' },
    ],
  },
  {
    module: 'integrations',
    tools: [
      { name: 'list_integration_records', method: 'GET', path: '/api/integrations', status: 'ready' },
      { name: 'create_integration_record', method: 'POST', path: '/api/integrations', status: 'ready' },
      { name: 'update_integration_record', method: 'PATCH', path: '/api/integrations/:id', status: 'ready' },
      { name: 'archive_integration_record', method: 'PATCH', path: '/api/integrations/:id/archive', status: 'ready' },
    ],
  },
];

router.use(authMiddleware);

router.get('/capabilities', (req, res) => {
  res.json({
    protocol: 'planned-mcp-wrapper',
    auth: 'JDHub bearer token required',
    storageTimePolicy: 'UTC Date values in MongoDB; clients display in local time.',
    capabilities,
  });
});

module.exports = router;
