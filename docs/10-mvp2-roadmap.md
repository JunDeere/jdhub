# 10 - MVP 2 Roadmap

## Purpose

MVP 1 made JDHub functional as a private command center.

MVP 2 should make JDHub easier to understand, safer to deploy, and more practical for regular use without needing a tutorial.

Progress and implementation history are tracked in `docs/11-progress-log.md`.

## Current Product State

JDHub can currently run through Docker Compose with:

- Authentication
- Dashboard
- Notes
- Tasks
- App-wide attention signals
- Scheduling
- Finance
- Projects
- Knowledge Base
- Files
- Command Center
- Global search
- Server Manager
- Integrations
- Module Status
- Collapsible sidebar

The app is usable as a private owner/developer MVP.

It is not yet ready as a general user-facing product because onboarding, empty states, role controls, data management, and production hardening still need work.

---

## MVP 2 - Usability

### Goal

Make JDHub understandable without a separate tutorial.

### Tasks

- Add onboarding checklist on Dashboard - in progress, now collapsible by default
- Add empty-state actions - in progress:
  - Add task - done
  - Create project - done
  - Write note - done
  - App-wide attention signal - done
  - Add transaction - done
  - Create knowledge page - done
- Hide or disable planned modules until implemented - done:
  - Files is now implemented as a private cloud workspace
  - Receipts was folded into Finance
  - Automations remains visibly disabled
- Add a finance cash-flow forecast separate from actual transactions - done:
  - Starting account balance and dated income/payment projection
  - Combined date-range payments with calculated running balance
  - Financing overview with remaining balances, payments left, and expected installments
  - Planned/completed/skipped status controls without changing actual transaction totals
- Unify Command Center and the app-wide assistant - done:
  - Topbar prompt sends questions and supported commands to the same assistant
  - Closed state is a compact Ask JDHub launcher across modules
  - First open is a Messenger-style floating chat at the bottom-right
  - Expanded state is a resizable right-side panel with independent scrolling beside the current module
  - Floating and docked assistant views provide access to conversation and recent-command history
  - Command Center alone provides the full chat with a minimal search/history panel
  - The same conversation is reused while moving between assistant states and modules
  - Separate New Command form removed; commands now use the shared chat composer and preview flow
- Add notification-style setup/system inbox - moved to topbar bell dropdown
- Fold reminders into app-wide attention signals - done, Reminders is no longer a sidebar module
- Add first-run sample prompts without creating fake data
- Add clear module descriptions and "what to do next" copy
- Improve form validation and friendlier error messages - in progress:
  - Tasks - done
  - Projects - done
  - Finance - done
  - Scheduling - done
  - Knowledge Base - done
  - Integrations - done
  - Server Manager - done
- Add success toasts or consistent inline confirmation after saves - in progress, inline confirmations exist on current record forms
- Improve loading states and disabled buttons during saves - in progress, save buttons are disabled during current form submissions

### Done When

A new user can sign in, understand what JDHub is for, and create their first few records without outside explanation.

---

## MVP 2 - User and Admin Basics

### Goal

Add basic user management and owner/admin control.

### Tasks

- Add account profile completion prompt
- Add user role field - done:
  - owner
  - admin
  - member
- Add an admin-only account-management interface - done:
  - Create member accounts
  - List accounts
  - Enable or disable member access
- Disable public self-registration by default - done
- Add email verification for sign-ins from new browsers - done
- Add trusted-browser and security-event management - done
- Make Module Status admin-only
- Make system settings admin-only where appropriate
- Add password change
- Add optional invitation delivery on top of admin-managed account creation
- Improve logout/session expiry behavior

### Done When

JDHub can distinguish owner/admin/member behavior and guide users to complete basic account setup.

---

## MVP 2 - Data Management

### Goal

Make data easier to move, recover, and manage over time.

### Tasks

- Export data as JSON
- Export tabular modules as CSV
- Import basic CSV for transactions
- Import basic CSV for tasks
- Add archive views for:
  - Tasks
  - Projects
  - Notes
  - Knowledge Base
- Add soft-delete restore flow
- Add basic backup script or documented backup command - documented basic MongoDB backup command
- Add data retention notes
- Standardize UTC storage and local-time display - done for current date/time fields

### Done When

The owner can export, back up, import, archive, and restore important data without directly touching MongoDB.

---

## MVP 2 - Production Readiness

### Goal

Make the Docker deployment safer and clearer for real hosting.

### Tasks

- Add production `.env.example` - in progress, local and backend examples now include security settings
- Add strong JWT secret guidance - in progress, production Compose now requires `JWT_SECRET`
- Add Docker Compose production override - done
- Add HTTPS / reverse proxy notes - in progress, README now flags reverse-proxy HTTPS before public exposure
- Confirm and document MongoDB persistent volume behavior - done, `jdhub_mongo-data` volume
- Confirm date/time storage policy - done, UTC in database and local browser display
- Add rate limiting for auth routes - done
- Add Helmet/security headers - done
- Configure CORS by environment - done
- Add healthchecks in Docker Compose - done
- Add basic server deployment guide

### Done When

JDHub has clear production deployment instructions and safer defaults for public or home-server hosting.

---

## MVP 2 - Quality

### Goal

Reduce regression risk and keep the codebase maintainable.

### Tasks

- Add API smoke tests - done for current backend core/security workflows
- Add frontend form behavior tests
- Add seed/demo data script - done
- Fix current ESLint issues - done
- Add README setup instructions matching the real app - in progress

### Done When

Core workflows have automated checks, lint issues are resolved, and setup documentation matches how JDHub actually runs.

---

## Suggested Build Order

1. Usability pass
2. Validation, loading, and confirmation polish
3. Production hardening
4. MCP/API capability map
5. User roles and account basics
6. Data export/import/archive tools
7. Quality/testing pass

---

## MCP Readiness

### Goal

Prepare JDHub so a future MCP server can safely expose app functions to trusted AI clients.

### Tasks

- Keep MCP access behind JDHub authentication - in progress
- Add API capability map for MCP tool planning - done at `/api/mcp/capabilities`
- Define read tools for current modules - documented
- Define write tools for current modules - documented
- Add scoped MCP/API tokens - not started
- Add read-only MCP implementation before write tools - not started
- Add confirmation behavior for broad or destructive MCP writes - not started

### Done When

An AI client can retrieve JDHub context and perform approved actions through a scoped, authenticated MCP server without direct database access.

## MVP 2 Rule

```text
Make the existing modules clear, safe, and reliable before adding more major modules.
```
