# 03 - Command Center Plan

## Purpose

The Command Center is the main interaction layer of JDHub.

The user should be able to type commands or questions and have JDHub create, search, summarize, or update records across modules.

The Command Center should start simple and safe. It should begin as a rule-based command parser, not a full AI system.

## Main Idea

Every module should be usable in two ways:

```text
1. Manual UI
   Buttons, forms, pages, tables

2. Command Center
   Type natural commands to create/search/update records
```

Example:

```text
add note: blackout happened and nginx API was unhealthy
```

JDHub should detect:

```text
Action: Create Life Log
Category: Server
Tags: blackout, nginx
```

Then it should show a preview before saving.

## MVP Command Types

Start with only these commands:

```text
add note:
create task:
add reminder:
schedule:
log expense:
search:
summarize:
```

These are enough to prove the system.

## Example Commands

### Life Log

```text
add note: blackout happened and acer-server became unreachable
```

### Task

```text
create task: remove public port 5678 priority high
```

### Reminder

```text
add reminder: check UPS battery next month
```

### Scheduling

```text
schedule: gym tomorrow at 5pm
```

### Finance

```text
log expense: 250 food lunch cash
```

### Search

```text
search: nginx blackout
```

### Summary

```text
summarize this week
```

## Preview Before Saving

For create/update actions, JDHub should show a detected action preview.

Example:

```text
Detected Action: Add Expense
Amount: ₱250
Category: Food
Note: lunch
Payment Method: Cash

[Save] [Edit] [Cancel]
```

This prevents accidental writes.

## Command Flow

```text
User enters message
↓
Backend receives message
↓
Command parser detects intent
↓
Backend extracts fields
↓
Backend returns detected action preview
↓
User confirms
↓
Backend saves record
↓
Command history stores original message and action
```

## Command History

Every command should be stored for review.

### Fields

```text
original_message
detected_action
status
created_record_type
created_record_id
created_at
confirmed_at
cancelled_at
```

### Statuses

```text
pending_confirmation
confirmed
cancelled
failed
answered
```

## Saved Outputs

Some answers or summaries should be savable.

Example:

```text
summarize this week
```

The output can be saved as a Life Log, Knowledge Base page, or Saved Output.

## Rule-Based Parser First

The first parser should detect clear prefixes:

```text
add note:
create task:
add reminder:
schedule:
log expense:
search:
summarize:
```

This keeps the first version simple, private, and reliable.

## Smart Parser Later

After the rule-based parser works, JDHub can support looser phrases.

Example:

```text
I spent 250 pesos on food today
```

Detected:

```text
Action: log expense
Amount: 250
Currency: PHP
Category: Food
Date: today
```

## Local AI Later

Local AI can be added later using a tool like Ollama.

Recommended future flow:

```text
JDHub Command Center
↓
Node backend
↓
Local AI parser
↓
Backend validates action
↓
User confirms
↓
Backend saves to database
```

The AI should not directly access the database.

## Outside AI Later

Outside AI can be added later only through a safe backend layer.

Correct architecture:

```text
User message
↓
JDHub backend
↓
Relevant data/tools only
↓
Outside AI
↓
Structured suggestion/action
↓
JDHub validates
↓
User confirms
↓
Database write
```

## Safety Rules

The Command Center should not be allowed to directly perform dangerous actions.

### Safe Actions

- Create note
- Create task
- Create reminder
- Create schedule item
- Create finance transaction with confirmation
- Search records
- Summarize records

### Requires Confirmation

- Update task status
- Mark bill paid
- Change budget
- Create finance transaction
- Trigger automation
- Change project status

### Dangerous Actions Not Allowed Initially

- Delete records
- Run shell commands
- Restart containers
- Change passwords
- Modify database schema
- Send external webhooks automatically
- Expose private data to outside AI without approval

## Source-Aware Answers

When answering questions, JDHub should show which records were used.

Example:

```text
Answer:
Last time Nginx broke, it happened after a blackout.

Sources:
- Life Log: Blackout incident
- Server Manager: Nginx Proxy Manager API unhealthy
- Task: Reserve Acer server IP
```

## Main MVP Goal

The first important test is:

```text
Type: add note: today I fixed nginx
Result: JDHub saves a Life Log entry and displays it on the dashboard.
```

After that, add task, expense, schedule, search, and summary commands.
