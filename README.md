# JDHub

Current development version: **0.2.0-beta.1**

JDHub is a private personal command center built to connect notes, tasks,
scheduling, finance, projects, files, infrastructure records, integrations, and
an AI-assisted command interface into one system.

The goal is to build the core first, then flesh out each module over time.

## Planned Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Main Database: MongoDB
- Optional SQL Later: PostgreSQL or MySQL for strict/important records
- Containerization: Docker Compose
- Command Layer: Validated rule-based actions with an optional OpenRouter-backed assistant

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

Tools
- Files
- Automations (planned)

System
- Administration (admin only)
- Infrastructure (admin only)
- Integrations (admin only)
- Module Status
- Settings

App Shell
- Attention signals through the topbar notification bell
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
docs/12-mcp-implementation-plan.md
docs/13-versioning-and-releases.md
```

## Current Status

MVP 1 is implemented and deployable through Docker Compose. The current local
MVP 2 development line is version `0.2.0-beta.1`; it is a prerelease and has not
yet been tagged or pushed as a release.

Current focus: MVP 2 usability, user/admin basics, data management, production readiness, and quality.

Release history is recorded in [`CHANGELOG.md`](CHANGELOG.md), and the versioning
policy is documented in [`docs/13-versioning-and-releases.md`](docs/13-versioning-and-releases.md).

## Local Docker Setup

Copy `.env.example` to `.env`, then start JDHub:

```powershell
docker compose up -d --build
```

The frontend is available at `http://localhost:5173`. The backend is published at
`http://localhost:3001` by default and remains on port `3000` inside Docker. Set
`APP_PORT` in `.env` if another host port is needed.

## Docker Data Persistence

MongoDB uses the named Docker volume `jdhub_mongo-data`, mounted at `/data/db` in the `mongo` service.
Uploaded files use the host folder configured by `FILE_STORAGE_PATH` and are mounted
at `/data/jdhub-files` inside the backend container. For the Acer server, set this
to `/home/jdeere/jdhub/jdhub-cloud`. The folder is ignored by Git, should be included
in backups, and must not be served directly by the web server. File downloads still
require an authenticated JDHub account. Physical uploads are isolated under
`jdhub-cloud/users/<user-id>`; their user-facing folders remain database-managed.
JDHub enforces a 300 GB shared storage ceiling and a 10 GB allowance per account
by default, including the demo account. Uploads are first written to a private
incoming area, inspected for executable payloads, hashed, and only then moved into
the user's storage. This inspection is a safety baseline, not a replacement for a
full antivirus engine.

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

## Windows Notepad Backup

On the Windows workstation, JDHub can keep a one-way backup of the current
Windows 11 Notepad tabs. Notepad remains the primary editor. Imported desktop
notes are read-only in JDHub, where **Make editable web copy** creates a separate
normal web note when needed.

The local bridge reads the Notepad session without modifying it, sends decoded
notes to the owner account, and also stores the raw session files for recovery.
Its private settings live in the ignored `backend/.env.notepad-bridge` file.

Run one backup check manually:

```powershell
cd backend
npm run sync:notepad:once
```

Run the continuous bridge in the current terminal:

```powershell
cd backend
npm run sync:notepad
```

The configured workstation also runs this bridge through the Windows scheduled
task named `JDHub Notepad Backup` at sign-in.

## Production Compose

Use the production override when deploying outside local development:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Set a strong `JWT_SECRET`, production `CORS_ORIGINS`, and any reverse-proxy HTTPS settings before exposing JDHub.
Set `PUBLIC_SHARE_ORIGIN=https://share.jdeere.net` for 24-hour external file links, and include both the private JDHub origin and the share origin in `CORS_ORIGINS`.
Production Compose disables new account registration by default. Existing users
can still sign in; set `ALLOW_REGISTRATION=true` only during a controlled account
creation window.

Create or reset the isolated public demo account with:

```powershell
docker compose exec backend npm run seed:demo
```

The demo account uses `demo@demo.com` / `demo`, restores fictional sample data
on every login, blocks profile edits, and has a separate AI request limit. Never
reuse these credentials for a real account.
On a server using a local reverse proxy or Cloudflare Tunnel, set
`FRONTEND_BIND=127.0.0.1`, `BACKEND_BIND=127.0.0.1`, and
`MONGO_BIND=127.0.0.1` so those ports are not exposed directly to the network.

## Synthetic Finance Forecast Fixture

The tracked finance seed contains fictional data only. Keep personal balances,
loan details, payment schedules, exports, and screenshots out of source control.

For a disposable development database and test account, explicitly set
`MONGO_URI` and `FORECAST_USER_ID`, then run `npm run seed:finance-forecast` from
`backend`. Do not run the seed against a production database or a real account.
It upserts only the named `Synthetic example forecast v1` fixture and does not
migrate, rename, or remove existing private forecasts. Re-running resets that
synthetic fixture's data; it is not a personal-data import tool.

## MCP Planning

JDHub does not run a full MCP server yet. The authenticated endpoint below lists the current API functions that the future MCP server should wrap:

```text
GET /api/mcp/capabilities
Authorization: Bearer <JDHub token>
```

## Current Rule

Make the existing modules clear, safe, and reliable before adding more major modules.

## Optional Portfolio Demo Bridge

The embedded portfolio bridge is **disabled by default** in both production and
Vite development. It installs only for an authenticated account whose `isDemo`
value is exactly `true`, and only inside an iframe. See
[configuration and verification](docs/14-portfolio-demo-bridge.md) before enabling
it. No bridge settings grant access to real accounts or private context.
