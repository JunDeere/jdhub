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
- Notes
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
docs/10-mvp2-roadmap.md
docs/11-progress-log.md
```

## Current Status

MVP 1 is implemented and deployable through Docker Compose.

Current focus: MVP 2 usability, user/admin basics, data management, production readiness, and quality.

## Docker Data Persistence

MongoDB uses the named Docker volume `jdhub_mongo-data`, mounted at `/data/db` in the `mongo` service.

Normal redeploys keep data:

```powershell
docker compose up -d --build
docker compose down
```

Do not use this unless you intentionally want to delete the database volume:

```powershell
docker compose down -v
docker volume rm jdhub_mongo-data
```

Basic backup command:

```powershell
docker exec jdhub-mongo-1 mongodump --db jdhub --archive=/tmp/jdhub.archive
docker cp jdhub-mongo-1:/tmp/jdhub.archive ./jdhub.archive
```

## Current Rule

Make the existing modules clear, safe, and reliable before adding more major modules.
