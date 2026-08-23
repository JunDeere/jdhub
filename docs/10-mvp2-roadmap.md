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
- Reminders
- Scheduling
- Finance
- Projects
- Knowledge Base
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
  - Add reminder - done
  - Add transaction - done
  - Create knowledge page - done
- Hide or disable planned modules until implemented - done for Files, Receipts, and Automations
- Improve Command Center examples and command chips - in progress
- Add notification-style setup/system inbox - moved to topbar bell dropdown
- Add first-run sample prompts without creating fake data
- Add clear module descriptions and "what to do next" copy
- Improve form validation and friendlier error messages
- Add success toasts or consistent inline confirmation after saves
- Improve loading states and disabled buttons during saves

### Done When

A new user can sign in, understand what JDHub is for, and create their first few records without outside explanation.

---

## MVP 2 - User and Admin Basics

### Goal

Add basic user management and owner/admin control.

### Tasks

- Add account profile completion prompt
- Add user role field:
  - owner
  - admin
  - member
- Make Module Status admin-only
- Make system settings admin-only where appropriate
- Add password change
- Add optional invite-only registration
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

- Add production `.env.example`
- Add strong JWT secret guidance
- Add Docker Compose production override
- Add HTTPS / reverse proxy notes
- Confirm and document MongoDB persistent volume behavior - done, `jdhub_mongo-data` volume
- Confirm date/time storage policy - done, UTC in database and local browser display
- Add rate limiting for auth routes
- Add Helmet/security headers
- Configure CORS by environment
- Add healthchecks in Docker Compose
- Add basic server deployment guide

### Done When

JDHub has clear production deployment instructions and safer defaults for public or home-server hosting.

---

## MVP 2 - Quality

### Goal

Reduce regression risk and keep the codebase maintainable.

### Tasks

- Add API smoke tests
- Add frontend form behavior tests
- Add seed/demo data script
- Fix current ESLint issues
- Add README setup instructions matching the real app

### Done When

Core workflows have automated checks, lint issues are resolved, and setup documentation matches how JDHub actually runs.

---

## Suggested Build Order

1. Usability pass
2. Validation, loading, and confirmation polish
3. User roles and account basics
4. Data export/import/archive tools
5. Production hardening
6. Quality/testing pass

## MVP 2 Rule

```text
Make the existing modules clear, safe, and reliable before adding more major modules.
```
