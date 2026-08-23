# 07 - Build Milestones

## Purpose

This document breaks JDHub into build milestones.

The goal is to avoid building everything at once. Each milestone should produce a working piece of the app.

## Main Rule

```text
Core first. Flesh out each function later.
```

## Current Progress

MVP 1 is complete through the original Week 12 sprint plan.

Detailed project history is tracked in `docs/11-progress-log.md`.

Implemented and deployable through Docker Compose:

- Dashboard
- Auth
- Life Log
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

Current focus should shift from adding modules to making the existing modules clearer, safer, and easier to use.

---

## Milestone 1 - Repository and Documentation

### Goal

Create the project structure and planning docs.

### Tasks

- Create GitHub repo
- Add README
- Add docs folder
- Add project overview
- Add modules/features plan
- Add database plan
- Add Command Center plan
- Add integration plan
- Add security/privacy plan

### Done When

The repo has clear documentation that explains what JDHub is and what should be built first.

---

## Milestone 2 - Base Project Setup

### Goal

Create the basic project structure.

### Planned Stack

- React + Vite frontend
- Node.js + Express backend
- MongoDB database
- Docker Compose

### Tasks

- Create `frontend/`
- Create `backend/`
- Create `docker-compose.yml`
- Create `.env.example`
- Create `.gitignore`
- Setup backend package.json
- Setup frontend package.json
- Create backend health check route
- Confirm frontend can call backend

### Done When

Running the project shows a React page and backend health check works.

---

## Milestone 3 - MongoDB Connection

### Goal

Connect backend to MongoDB.

### Tasks

- Add MongoDB service in Docker Compose
- Add backend MongoDB connection
- Add Mongoose or native MongoDB client
- Create first test model
- Add health check showing DB connection status

### Done When

Backend can connect to MongoDB and return database status.

---

## Milestone 4 - Basic Auth

### Goal

Add login foundation.

### Tasks

- Create User model
- Add registration endpoint or seed first user
- Add login endpoint
- Hash password
- Add protected routes
- Store auth token/session on frontend
- Add logout

### Done When

User can login and access protected dashboard.

---

## Milestone 5 - Dashboard Shell

### Goal

Build the main app layout.

### Tasks

- Create sidebar layout
- Add main navigation structure
- Add Dashboard page
- Add placeholder pages for modules
- Add responsive layout basics

### Done When

User can login and move around the JDHub layout.

---

## Milestone 6 - Life Log MVP

### Goal

Build first real module.

### Tasks

- Create Entry model
- Create Life Log API routes
- Create Life Log page
- Add create entry form
- Add list entries
- Add edit entry
- Add delete/archive entry
- Add tags/category fields

### Done When

User can create, view, edit, and archive life log entries.

---

## Milestone 7 - Tasks MVP

### Goal

Build task tracking.

### Tasks

- Create Task model
- Create task API routes
- Create Tasks page
- Add task form
- Add task list
- Add status and priority
- Add due date
- Add mark done

### Done When

User can manage basic tasks.

---

## Milestone 8 - Finance Transactions MVP

### Goal

Add basic personal finance tracking.

### Tasks

- Create Transaction model
- Create finance API routes
- Create Finance page
- Add transaction form
- Add transaction list
- Add income/expense type
- Add category
- Add monthly totals

### Done When

User can log expenses/income and see basic monthly totals.

---

## Milestone 9 - Scheduling and Reminders MVP

### Goal

Add internal reminders and schedule items.

### Tasks

- Create Reminder model
- Create ScheduleItem model
- Create reminder API routes
- Create schedule API routes
- Create Reminders page
- Create Scheduling page
- Add upcoming items to Dashboard

### Done When

User can create reminders and schedule items internally.

---

## Milestone 10 - Projects MVP

### Goal

Add project tracking.

### Tasks

- Create Project model
- Create Projects page
- Add project create/edit
- Add project status
- Add project overview
- Add project milestones field
- Link tasks to project
- Link entries to project

### Done When

User can create projects and connect notes/tasks to them.

---

## Milestone 11 - Knowledge Base MVP

### Goal

Add reusable documentation pages.

### Tasks

- Create Knowledge Page model or use Entries with type `knowledge_page`
- Create Knowledge Base page
- Add markdown-like content field
- Add search
- Add tags/categories
- Link page to project

### Done When

User can store and search personal documentation.

---

## Milestone 12 - Command Center MVP

### Goal

Make the Command Center create records from typed commands.

### Initial Commands

```text
add note:
create task:
log expense:
add reminder:
schedule:
search:
summarize:
```

### Tasks

- Create command message model
- Create command action model
- Build rule-based parser
- Add Command Center page
- Show detected action preview
- Add Save/Edit/Cancel flow
- Save command history

### Done When

Typing `add note: today I fixed nginx` creates a Life Log after confirmation.

---

## Milestone 13 - Search and Summaries

### Goal

Search across important modules.

### Tasks

- Add text search for entries
- Add task search
- Add project search
- Add finance search
- Add global search endpoint
- Add basic summaries without AI

### Done When

User can search for `nginx blackout` and see matching records.

---

## Milestone 14 - MVP 2 Usability

### Goal

Make JDHub understandable without a tutorial.

### Tasks

- Add onboarding checklist on Dashboard
- Add empty-state actions
- Hide or disable planned modules until implemented
- Improve Command Center examples and command chips
- Add first-run sample prompts without fake data
- Add clear module descriptions and next actions
- Improve validation and friendly errors
- Add success confirmations
- Improve loading states

### Done When

A new user can sign in and understand what to do next without separate explanation.

---

## Milestone 15 - User and Admin Basics

### Goal

Add basic user setup and admin controls.

### Tasks

- Add account profile completion prompt
- Add user roles: owner, admin, member
- Make Module Status/admin settings role-aware
- Add password change
- Add optional invite-only registration
- Improve logout/session expiry behavior

### Done When

JDHub can distinguish owner/admin/member behavior and guide account setup.

---

## Milestone 16 - Data Management

### Goal

Make records easier to export, import, archive, restore, and back up.

### Tasks

- Export data as JSON/CSV
- Import basic CSV for transactions/tasks
- Add archive views for tasks, projects, logs, and knowledge pages
- Add soft-delete restore flow
- Add basic backup script or documented backup command
- Add data retention notes

### Done When

The owner can manage and recover data without directly touching MongoDB.

---

## Milestone 17 - Production Readiness

### Goal

Make Docker deployment safer and clearer for real hosting.

### Tasks

- Add production `.env.example`
- Add strong JWT secret guidance
- Add Docker Compose production override
- Add HTTPS / reverse proxy notes
- Confirm MongoDB persistent volume behavior
- Add rate limiting for auth routes
- Add Helmet/security headers
- Configure CORS by environment
- Add healthchecks in Docker Compose
- Add basic server deployment guide

### Done When

JDHub has safer production defaults and clear deployment instructions.

---

## Milestone 18 - Quality

### Goal

Reduce regression risk and align documentation with the real app.

### Tasks

- Add API smoke tests
- Add frontend form behavior tests
- Add seed/demo data script
- Fix current ESLint issues
- Add README setup instructions matching the real app

### Done When

Core workflows have checks and setup docs match the actual project.

---

## Later Milestones

These should wait until MVP 2 makes the existing app clearer and safer:

- Receipts MVP
- File uploads
- OCR
- Google Calendar integration
- GitHub integration
- n8n integration
- Local AI/Ollama
- Outside AI through safe backend tools
- Mobile/PWA polish
