# 04 - Database Plan

## Main Direction

JDHub should use MongoDB first.

The purpose of using MongoDB is to learn a new database style and support flexible personal records that may not always fit clean SQL tables.

SQL may be added later only for strict or important data, such as finance, audit logs, or records that need stronger relational rules.

## Database Strategy

```text
Phase 1: MongoDB only
Phase 2: Add better indexes and search
Phase 3: Add SQL later only if needed
```

## Why MongoDB Fits JDHub

JDHub will store flexible records:

- Life logs
- Notes
- Server incidents
- Project notes
- Knowledge pages
- Command messages
- File metadata
- Automation references

These records may have different shapes, tags, categories, and metadata.

MongoDB is useful because entries can store flexible `metadata` fields without changing the database structure every time.

## Core Collections for MVP

Start with these collections:

```text
users
entries
tasks
projects
transactions
command_messages
command_actions
settings
```

## Expanded Collections Later

Add these later as modules grow:

```text
reminders
schedule_items
budgets
bills
savings_goals
knowledge_pages
files
receipts
automations
server_records
integration_connections
saved_outputs
tags
```

## Collection: users

Stores user accounts.

### Fields

```text
_id
name
email
password_hash
role
created_at
updated_at
```

## Collection: entries

Flexible collection for personal records.

This can store:

- Life logs
- Ideas
- Server notes
- Incidents
- Learning notes
- Project notes
- General notes

### Fields

```text
_id
user_id
type
title
content
category
tags
related_project_id
related_task_id
metadata
created_at
updated_at
archived_at
```

### Example Document

```json
{
  "type": "server_incident",
  "title": "Blackout broke Acer server access",
  "content": "Acer server became unreachable after blackout. Nginx Proxy Manager API showed unhealthy.",
  "category": "Server",
  "tags": ["acer-server", "nginx", "blackout", "docker"],
  "metadata": {
    "container": "nginx_proxy_manager",
    "port": 81,
    "possible_cause": "reboot/network/DNS issue"
  }
}
```

## Collection: tasks

Stores personal and project tasks.

### Fields

```text
_id
user_id
title
description
status
priority
category
due_date
related_project_id
tags
created_at
updated_at
completed_at
cancelled_at
```

### Statuses

```text
backlog
todo
doing
blocked
done
cancelled
```

### Priorities

```text
low
medium
high
urgent
```

## Collection: projects

Stores project records.

### Fields

```text
_id
user_id
name
slug
description
goal
status
tech_stack
links
milestones
notes
created_at
updated_at
archived_at
```

### Project Statuses

```text
idea
planning
in_progress
paused
testing
done
archived
```

## Collection: transactions

Stores finance transactions.

MongoDB can be used for MVP finance, but SQL may be considered later if finance grows more strict.

### Fields

```text
_id
user_id
type
amount
currency
category
date
merchant_or_source
payment_method
note
receipt_id
is_recurring
tags
created_at
updated_at
```

### Transaction Types

```text
income
expense
transfer
```

## Collection: command_messages

Stores raw Command Center messages.

### Fields

```text
_id
user_id
message
mode
status
created_at
```

### Modes

```text
command
search
summary
question
```

## Collection: command_actions

Stores detected actions from Command Center messages.

### Fields

```text
_id
user_id
command_message_id
action_type
payload
status
preview_text
created_record_type
created_record_id
created_at
confirmed_at
cancelled_at
failed_at
error_message
```

### Statuses

```text
pending_confirmation
confirmed
cancelled
failed
answered
```

## Collection: settings

Stores app settings.

### Fields

```text
_id
user_id
key
value
created_at
updated_at
```

## Future Collection: reminders

Stores reminders.

### Fields

```text
_id
user_id
title
description
remind_at
status
related_task_id
related_project_id
tags
created_at
updated_at
completed_at
```

## Future Collection: schedule_items

Stores internal schedule items before connecting to Google Calendar.

### Fields

```text
_id
user_id
title
description
start_at
end_at
location
status
related_project_id
related_task_id
external_calendar_id
created_at
updated_at
```

## Future Collection: budgets

Stores budget limits by category and period.

### Fields

```text
_id
user_id
name
category
amount
currency
period
start_date
end_date
created_at
updated_at
```

## Future Collection: bills

Stores bills.

### Fields

```text
_id
user_id
name
amount
currency
due_date
status
is_recurring
recurrence_rule
payment_method
notes
created_at
updated_at
paid_at
```

## Future Collection: savings_goals

Stores savings goals.

### Fields

```text
_id
user_id
name
target_amount
current_amount
currency
deadline
priority
notes
created_at
updated_at
completed_at
```

## Future Collection: files

Stores file metadata.

Actual files can be stored locally first.

### Fields

```text
_id
user_id
filename
original_name
mime_type
size
storage_path
related_type
related_id
tags
created_at
updated_at
```

## Future Collection: integrations

Stores outside tool connections.

### Fields

```text
_id
user_id
provider
name
status
config
created_at
updated_at
last_checked_at
```

## Indexing Plan

Add indexes for common searches:

```text
entries: user_id, type, category, tags, created_at
entries: text index on title/content/tags
tasks: user_id, status, priority, due_date
projects: user_id, status, slug
transactions: user_id, date, category, type
command_messages: user_id, created_at
```

## SQL Later

SQL can be added later for:

- Finance transactions if accounting rules become strict
- Audit logs
- User permissions
- Integration event logs
- Records requiring strong joins and constraints

Do not add SQL in the first MVP unless absolutely needed.

## Core Rule

MongoDB first. Keep the data model flexible. Add stricter systems only after the MVP works.
