# 07 - Build Milestones

## Purpose

This document breaks JDHub into build milestones.

The goal is to avoid building everything at once. Each milestone should produce a working piece of the app.

## Main Rule

```text
Core first. Flesh out each function later.
```

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

## Milestone 14 - Receipts MVP

### Goal

Add manual receipt tracking.

### Tasks

- Create Receipt model
- Add Receipts page
- Add manual receipt form
- Link receipt to finance transaction
- Add file upload later

### Done When

User can manually add receipts and link them to expenses.

---

## Milestone 15 - Server Manager MVP

### Goal

Track server notes and infrastructure records manually.

### Tasks

- Create server records
- Add server notes
- Add incident logs
- Add Docker container records manually
- Add port records manually
- Add domain/subdomain notes

### Done When

User can document Acer server, Docker containers, ports, and incidents.

---

## Milestone 16 - Integrations Placeholder

### Goal

Create a place to track future integrations.

### Tasks

- Create Integration model
- Add Integrations page
- Add provider, status, notes
- Add planned/active/broken status

### Done When

User can record planned integrations like Google Calendar, GitHub, n8n, and local AI.

---

## Milestone 17 - Local AI / Outside AI Later

### Goal

Enhance Command Center with AI.

### Tasks

- Add AI provider setting
- Add local AI test endpoint
- Add safe tool layer
- Add structured AI response validation
- Keep confirmation before writes

### Done When

AI can help parse a command, but JDHub still controls database writes.

---

## Milestone 18 - Polish and Deployment

### Goal

Make JDHub usable daily.

### Tasks

- Improve UI
- Add loading states
- Add error handling
- Add backups
- Add Docker restart policies
- Add HTTPS behind Nginx Proxy Manager
- Add deployment notes

### Done When

JDHub is stable enough to use personally.
