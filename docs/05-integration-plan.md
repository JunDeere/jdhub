# 05 - Integration Plan

## Purpose

This document defines how JDHub should connect to outside tools later.

The important rule is:

```text
Build the core first. Add integrations later.
```

JDHub should work internally before depending on Google Calendar, GitHub, n8n, Make.com, Discord, outside AI, or other services.

## Integration Philosophy

JDHub should own the core record first, then sync or connect to outside tools.

Example:

```text
JDHub Schedule Item
↓ later
Google Calendar Event
```

Not the other way around for MVP.

## Planned Integration Areas

```text
Tasks       → Google Tasks / Todoist / Notion later
Reminders   → Email / push / Discord / Telegram later
Scheduling  → Google Calendar later
Finance     → Receipt OCR / bank CSV import later
Projects    → GitHub / Codex / repository references later
Files        → Google Drive / local storage later
Automations  → n8n / Make.com later
Server       → Docker / Nginx / SSH status later
AI           → Local AI first if possible, outside AI through safe backend tools later
```

---

## 1. Scheduling Integration

### Core First

JDHub should first have its own internal schedule system.

MVP:

- Create schedule item
- Set start date/time
- Set end date/time
- Add title, description, location
- Link to task or project

### Future Google Calendar Integration

Later, JDHub can connect to Google Calendar.

Future functions:

- Import Google Calendar events
- Create Google Calendar events from JDHub
- Update Google Calendar events from JDHub
- Delete/cancel Google Calendar events with confirmation
- Detect conflicts
- Link Google Calendar event ID to JDHub schedule item

### Safety Rule

JDHub should ask for confirmation before creating, updating, or deleting Google Calendar events.

---

## 2. Task and Reminder Integrations

### Core First

Tasks and reminders should exist inside JDHub first.

MVP:

- Create task
- Create reminder
- Mark complete
- Filter by status/date/priority

### Future Outside Tools

Possible integrations:

- Google Tasks
- Todoist
- Notion
- Email reminders
- Discord reminders
- Telegram reminders
- Push notifications

### Sync Direction

Preferred future direction:

```text
JDHub task/reminder is the source of truth.
Outside tools are optional notification or sync targets.
```

---

## 3. Project and Build Integrations

### Core First

Projects should be stored in JDHub first.

MVP:

- Project overview
- Milestones
- Project notes
- Project tasks
- Project status

### Future GitHub Integration

Possible future features:

- Link project to GitHub repo
- Show repository URL
- Show current branch
- Show recent commits
- Show open issues
- Show open pull requests
- Link Codex sessions or work references

### Future Codex/Build References

JDHub can store references to:

- Repo path
- Feature branch
- Codex instructions
- Build logs
- Deployment notes
- Project documentation

### Safety Rule

Do not let AI or integrations directly change code or create commits without user confirmation.

---

## 4. Files Integration

### Core First

Files should first be stored locally or as simple metadata.

MVP:

- Upload file
- Save metadata
- Link file to a record

### Future Google Drive Integration

Future features:

- Link Google Drive folders
- Attach Drive files to projects
- Search file metadata
- Import selected files
- Export selected docs

### Safety Rule

Do not automatically share or make files public.

---

## 5. Receipts and Finance Integration

### Core First

Finance and receipts should work manually first.

MVP:

- Log expense manually
- Add receipt record manually
- Link receipt to transaction

### Future OCR Integration

Possible future flow:

```text
Upload receipt image
↓
OCR reads text
↓
System extracts merchant/date/amount
↓
User confirms
↓
Receipt and transaction are saved
```

### Future Bot Integration

Possible bots:

- Discord receipt bot
- Messenger receipt bot
- Telegram receipt bot

### Future CSV/Bank Import

Possible later features:

- Import CSV transactions
- Categorize transactions
- Match receipts to expenses

### Safety Rule

Finance data should not be sent to outside AI unless only the minimum required data is shared.

---

## 6. Automation Integration

### Core First

JDHub should first store automation records manually.

MVP:

- Automation name
- Platform
- Purpose
- Status
- Notes
- Webhook URL/reference

### Future n8n Integration

Future features:

- Store n8n workflow references
- Trigger webhook manually
- View last run status
- Log automation errors

### Future Make.com Integration

Future features:

- Store scenario references
- Store webhook URLs
- Store setup notes/SOPs

### Safety Rule

Triggering automations should require confirmation if they can send messages, change data, or call outside services.

---

## 7. Server Manager Integration

### Core First

Server Manager should first be manual notes and records.

MVP:

- Server notes
- Server incidents
- Port records
- Docker container list records
- Domain/subdomain notes

### Future Live Infrastructure Integration

Future features:

- Read Docker container status
- Check uptime
- Check disk usage
- Check RAM usage
- Check exposed ports
- Check Nginx Proxy Manager status
- Show SSL status

### Dangerous Actions

These should not be allowed at first:

- Restart server
- Restart Docker containers
- Run shell commands
- Edit Nginx config automatically
- Open/close public ports

If added later, they must require confirmation.

---

## 8. AI Integration

### Core First

Use rule-based Command Center first.

### Local AI Later

Local AI is preferred when privacy matters.

Possible local AI setup:

```text
JDHub Node backend
↓
Ollama/local model endpoint
↓
Structured command result
↓
JDHub validates and asks confirmation
```

### Outside AI Later

Outside AI can be added later, but it must not get direct database access.

Correct flow:

```text
JDHub backend
↓
Relevant selected data only
↓
Outside AI
↓
Structured response/action
↓
JDHub validates
↓
User confirms
↓
Database write
```

### Rule

AI should never receive database credentials, server credentials, or unrestricted access.

---

## Integration Records

Future integration records should track:

```text
provider
name
status
connection_type
config
last_checked_at
created_at
updated_at
```

## Integration Statuses

```text
planned
active
paused
broken
archived
```

## MVP Rule

Do not build integrations in the first MVP.

The first MVP should only prepare the structure so integrations can be added later cleanly.
