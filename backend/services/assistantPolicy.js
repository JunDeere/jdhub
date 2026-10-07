const MODULES = Object.freeze({
  dashboard: { label: 'Home', context: ['tasks', 'schedule', 'projects', 'lifeLog', 'knowledge'], actions: ['update_task'] },
  'command-center': { label: 'Command Center', context: ['tasks', 'schedule', 'projects', 'lifeLog', 'knowledge', 'finance'], actions: ['create_life_log', 'create_task', 'update_task', 'create_transaction'] },
  'life-log': { label: 'Notes', context: ['lifeLog'], actions: ['create_life_log'] },
  diary: { label: 'Diary', context: [], actions: [], privateReason: 'Diary stays inside the encrypted browser vault and is never sent to the assistant. Unlock and work with entries directly in Diary.' },
  tasks: { label: 'Tasks', context: ['tasks'], actions: ['create_task', 'update_task'] },
  scheduling: { label: 'Scheduling', context: ['schedule'], actions: [] },
  finance: { label: 'Finance', context: ['finance'], actions: ['create_transaction'] },
  projects: { label: 'Projects', context: ['projects', 'tasks'], actions: [] },
  'knowledge-base': { label: 'Knowledge Base', context: ['knowledge'], actions: [] },
  files: { label: 'Files', context: [], actions: [], privateReason: 'File names, paths, contents, shares, and tokens are excluded from assistant context. Use Files directly to upload, organize, download, or share.' },
  automations: { label: 'Automations', context: [], actions: [], privateReason: 'Automation credentials and triggers are excluded from assistant context. This module is currently planned and has no assistant actions.' },
  security: { label: 'Administration', context: [], actions: [], privateReason: 'Security events, sessions, trusted networks, and credentials are excluded from assistant context. Use Administration directly for account security.' },
  'server-manager': { label: 'Infrastructure', context: [], actions: [], privateReason: 'Infrastructure hosts, ports, credentials, and operational details are excluded from assistant context. Use Infrastructure directly for records; the assistant never runs shell commands.' },
  integrations: { label: 'Integrations', context: [], actions: [], privateReason: 'Integration configuration and credentials are excluded from assistant context. Use Integrations directly to manage planning records.' },
  'module-status': { label: 'Module Status', context: [], actions: [], helpText: 'Module Status is read-only operational health. Review the page directly for current API, database, and module availability; the assistant does not ingest health internals.' },
  settings: { label: 'Settings', context: [], actions: [], privateReason: 'Profile and session settings are excluded from assistant context. Use Settings directly to change your profile or theme.' },
});

const ACTION_MODULE = Object.freeze({
  create_life_log: 'life-log',
  create_task: 'tasks',
  update_task: 'tasks',
  create_transaction: 'finance',
});

function normalizeModule(value) {
  const moduleId = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return Object.hasOwn(MODULES, moduleId) ? moduleId : 'command-center';
}

function modulePolicy(value) {
  const moduleId = normalizeModule(value);
  return { moduleId, ...MODULES[moduleId] };
}

function requestedModule(value) {
  if (value == null || value === '') return 'command-center';
  const moduleId = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!Object.hasOwn(MODULES, moduleId)) {
    const error = new Error('Unknown assistant module');
    error.statusCode = 400;
    throw error;
  }
  return moduleId;
}

function actionAllowed(moduleId, actionType) {
  const policy = modulePolicy(moduleId);
  return policy.actions.includes(actionType) || policy.moduleId === 'command-center';
}

function assertActionScope(moduleId, actionType) {
  if (!Object.hasOwn(ACTION_MODULE, actionType)) {
    const error = new Error('Unsupported assistant action type');
    error.statusCode = 400;
    throw error;
  }
  if (!actionAllowed(moduleId, actionType)) {
    const error = new Error(`${modulePolicy(moduleId).label} cannot propose ${actionType.replaceAll('_', ' ')} actions`);
    error.statusCode = 403;
    throw error;
  }
}

function contextCounts(context) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, Array.isArray(value) ? value.length : value ? 1 : 0]));
}

module.exports = {
  ACTION_MODULE,
  MODULES,
  actionAllowed,
  assertActionScope,
  contextCounts,
  modulePolicy,
  normalizeModule,
  requestedModule,
};
