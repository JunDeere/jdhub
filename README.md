# JDHub

JDHub is a private personal command center built to connect personal logs, tasks, scheduling, finance, projects, files, automations, receipts, server management, and a command/chat interface into one system.

The goal is to build the core first, then flesh out each module over time.

## Planned Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Main Database: MongoDB
- Optional SQL Later: PostgreSQL or MySQL for strict/important records
- Containerization: Docker Compose
- Command Layer: Rule-based command parser first, local/outside AI later

## Main Structure

```text
Dashboard

Command Center
- Chat
- Command History
- Saved Outputs

Personal
- Life Log
- Tasks
- Reminders
- Scheduling
- Finance
  - Overview
  - Budget
  - Transactions
  - Bills
  - Savings Goals

Work / Build
- Projects
- Knowledge Base
- Files

Tools
- Receipts
- Automations
- Server Manager
- Integrations

System
- Settings
```

## Documentation

Project planning lives in `/docs`:

```text
docs/01-project-overview.md
docs/02-modules-and-features.md
docs/03-command-center-plan.md
docs/04-database-plan.md
docs/05-integration-plan.md
docs/06-security-and-privacy.md
docs/07-build-milestones.md
docs/08-weekly-sprint-plan.md
docs/09-future-ideas.md
```

## Current Rule

Do not build everything at once. Build the core foundation first, then expand each module.
