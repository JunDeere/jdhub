# 06 - Security and Privacy

## Purpose

JDHub will store personal information, finance records, server notes, files, schedules, tasks, and future integration references.

Security and privacy must be part of the design from the start, even if the first version is simple.

## Core Security Rule

```text
Private by default.
Confirm before risky actions.
Never give AI or integrations direct unrestricted access.
```

## Login Required

JDHub should require login before accessing personal data.

MVP login can be simple, but it should still include:

- Password hashing
- Session or token authentication
- Protected API routes
- Protected frontend routes

## Private Data Types

JDHub may store:

- Personal notes
- Life logs
- Health notes
- Finance records
- Bills
- Receipts
- Server information
- Project plans
- Files
- Automation webhook references
- Future API tokens

These should not be exposed publicly.

## Database Safety

The database should not be publicly exposed.

Rules:

- MongoDB should not be open to the internet.
- Use Docker internal networking when possible.
- Use environment variables for credentials.
- Do not commit `.env` files.
- Use `.env.example` for placeholder values only.

## AI Safety

AI should never directly connect to the database.

Correct architecture:

```text
AI or Command Parser
↓
Backend-controlled tools/functions
↓
Validated database operations
```

AI should not receive:

- Database credentials
- Server credentials
- Full database dumps
- Unfiltered finance records
- Private files unless explicitly needed

## Outside AI Rule

If outside AI is added later, send only the minimum required context.

Good:

```text
Send 5 relevant notes about nginx.
```

Bad:

```text
Send all life logs, all finance records, all files, and all tasks.
```

## Confirmation Rules

The app should ask for confirmation before:

- Creating finance transactions from Command Center
- Marking bills as paid
- Updating budgets
- Triggering automations
- Updating Google Calendar events
- Creating outside tool records
- Running server commands
- Restarting containers
- Sending webhooks
- Deleting records

## Dangerous Actions Not Allowed in MVP

The first version should not allow:

- Shell command execution
- Docker container restart from UI
- Public port changes
- Automatic Google Calendar changes
- Automatic webhook triggers
- AI-powered deletion
- AI-powered password/settings changes
- Direct database modification by AI

## File Upload Safety

When file uploads are added:

- Restrict file size
- Restrict dangerous file types
- Store files outside public paths when possible
- Use generated filenames
- Keep original filename as metadata only
- Require login to access private files

## Finance Privacy

Finance data is sensitive.

Rules:

- Finance pages require login.
- Outside AI should receive summaries instead of raw transaction lists when possible.
- Receipts should not be public.
- Bank/CSV imports should not be added until basic finance is stable.

## Integration Secrets

Future integrations may require API keys or OAuth tokens.

Rules:

- Store secrets encrypted if possible.
- Do not show full tokens in UI.
- Do not log full tokens.
- Do not commit tokens.
- Allow integration disconnection.

## Server Manager Safety

Server Manager should begin as notes and status records only.

Future live server controls must require confirmation.

Very dangerous actions should require extra confirmation:

```text
Type CONFIRM to restart n8n.
```

## Public Exposure Checklist

For deployed JDHub:

- Only expose required public ports.
- Use HTTPS.
- Keep database private.
- Do not expose admin panels publicly.
- Protect Nginx Proxy Manager admin access.
- Use strong passwords.
- Set Docker restart policies.

## Backup Plan

JDHub should eventually have backups for:

- MongoDB database
- Uploaded files
- Environment configuration sample
- Important docs

Backups should not expose secrets publicly.

## Audit Trail Later

For important actions, JDHub should later keep audit logs.

Examples:

- Created finance transaction
- Marked bill paid
- Triggered automation
- Connected integration
- Updated schedule item
- Changed settings

## MVP Security Requirements

Minimum security for MVP:

1. Login required.
2. Passwords hashed.
3. `.env` ignored.
4. MongoDB not public.
5. API routes protected.
6. Command Center previews before saving.
7. No dangerous server actions.
8. No outside AI direct database access.
