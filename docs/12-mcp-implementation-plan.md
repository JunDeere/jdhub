# 12 - MCP Implementation Plan

## Purpose

JDHub should eventually expose its private command-center data to trusted AI clients through an MCP server.

The first step is not to give an AI direct database access. The first step is to keep JDHub's HTTP API clean, authenticated, UTC-safe, and explicit. The MCP server can then wrap those API functions.

## Current MCP-Ready Surface

JDHub now exposes an authenticated capability map:

```text
GET /api/mcp/capabilities
Authorization: Bearer <JDHub token>
```

This is not a full MCP server yet. It is a contract list for the functions the future MCP server should expose.

## Planned MCP Tools

### Dashboard

- `get_dashboard_summary`

### Notes

- `list_notes`
- `create_note`
- `update_note`
- `archive_note`

### Tasks

- `list_tasks`
- `create_task`
- `update_task`
- `mark_task_done`

### Attention Signals

- `list_attention_signals`
- `list_due_tasks`
- `list_today_schedule`
- `list_explicit_reminders`
- `complete_explicit_reminder`

Explicit reminder records can still exist internally, but they should feed the app-wide attention layer instead of becoming a separate user-facing module.

### Scheduling

- `list_schedule_items`
- `create_schedule_item`
- `update_schedule_item`

### Finance

- `list_transactions`
- `create_transaction`
- `update_transaction`
- `get_monthly_finance_summary`

### Projects

- `list_projects`
- `create_project`
- `update_project`
- `archive_project`

### Knowledge Base

- `list_knowledge_pages`
- `create_knowledge_page`
- `update_knowledge_page`
- `archive_knowledge_page`

### Command Center

- `list_command_history`
- `preview_command`
- `confirm_command`
- `cancel_command`
- `search_jdhub`

### Server Manager

- `list_server_records`
- `create_server_record`
- `update_server_record`
- `archive_server_record`

### Integrations

- `list_integration_records`
- `create_integration_record`
- `update_integration_record`
- `archive_integration_record`

## Rules For AI Access

- MCP must require explicit JDHub authentication.
- MCP should call JDHub API routes instead of connecting to MongoDB directly.
- Finance data should only be sent when the user asks for finance work.
- Search should default to summaries and IDs, not full private dumps.
- Write tools should return previews or clear summaries before destructive or broad actions.
- All date/time inputs should use UTC ISO strings at the API boundary.
- All user-facing date/time output should include or clearly imply local timezone conversion.

## Recommended Build Order

1. Keep hardening the HTTP API.
2. Add export and backup tools.
3. Add user/admin roles.
4. Create a separate `mcp-server` package that wraps the API.
5. Add read-only MCP tools first.
6. Add write MCP tools with confirmation behavior.
7. Add scoped tokens or API keys for MCP clients.
