# 08 - Weekly Sprint Plan

## Purpose

This document keeps the work focused week by week.

The goal is to avoid jumping into every feature at once.

## Sprint Rule

Each week should have:

- One main goal
- A small list of tasks
- A clear done condition
- Notes about what to avoid

---

## Week 1 - Project Foundation

### Goal

Create the base project structure and development setup.

### Tasks

- Create `backend/`
- Create `frontend/`
- Create `docker-compose.yml`
- Create `.env.example`
- Create `.gitignore`
- Setup Node backend package
- Setup React frontend package
- Setup backend health route
- Confirm frontend can call backend

### Done When

The project runs locally and the frontend can show backend health status.

### Avoid

- Do not build AI yet.
- Do not build all modules yet.
- Do not add Google Calendar yet.

---

## Week 2 - MongoDB and Auth

### Goal

Connect MongoDB and add basic authentication.

### Tasks

- Add MongoDB service
- Connect backend to MongoDB
- Create User model
- Add password hashing
- Add login endpoint
- Add protected route middleware
- Create basic login page
- Create dashboard route after login

### Done When

User can login and access protected dashboard.

### Avoid

- Do not worry about OAuth yet.
- Do not add integrations yet.

---

## Week 3 - Dashboard and Layout

### Goal

Build the main JDHub shell.

### Tasks

- Create sidebar layout
- Add navigation structure
- Add Dashboard page
- Add placeholder module pages
- Add top command input placeholder
- Add basic responsive styling

### Done When

The app visually feels like JDHub and has the planned sidebar structure.

### Avoid

- Do not perfect design yet.
- Do not overbuild components.

---

## Week 4 - Life Log MVP

### Goal

Build the first real module.

### Tasks

- Create Entry model
- Add create life log API
- Add list life logs API
- Add update life log API
- Add archive/delete life log API
- Create Life Log page
- Add category and tags
- Show recent life logs on Dashboard

### Done When

User can create and view Life Log entries.

### Avoid

- Do not add file attachments yet.
- Do not add AI summaries yet.

---

## Week 5 - Tasks MVP

### Goal

Build task management.

### Tasks

- Create Task model
- Add task API routes
- Create Tasks page
- Add task status
- Add priority
- Add due date
- Add mark done
- Show open tasks on Dashboard

### Done When

User can create, update, and complete tasks.

### Avoid

- Do not add outside task tool integrations yet.

---

## Week 6 - Finance Transactions MVP

### Goal

Build basic finance tracking.

### Tasks

- Create Transaction model
- Add finance API routes
- Create Finance page
- Add income/expense transaction form
- Add category field
- Add payment method field
- Add monthly income/expense totals
- Show finance summary on Dashboard

### Done When

User can log expenses and income and see basic monthly totals.

### Avoid

- Do not add OCR yet.
- Do not add bank CSV import yet.
- Do not add SQL yet unless required.

---

## Week 7 - Scheduling and Reminders MVP

### Goal

Add internal scheduling and reminders.

### Tasks

- Create Reminder model
- Create ScheduleItem model
- Add reminder API routes
- Add schedule API routes
- Create Reminders page
- Create Scheduling page
- Show upcoming reminders/schedule on Dashboard

### Done When

User can create internal reminders and schedule items.

### Avoid

- Do not add Google Calendar yet.

---

## Week 8 - Projects MVP

### Goal

Add project tracking.

### Tasks

- Create Project model
- Add project API routes
- Create Projects page
- Add project create/edit
- Add project status
- Add project notes
- Link tasks to project
- Link life logs to project

### Done When

User can create projects and connect tasks/notes to them.

### Avoid

- Do not add GitHub integration yet.

---

## Week 9 - Knowledge Base MVP

### Goal

Add personal documentation.

### Tasks

- Create Knowledge Base page
- Use Entry model with type `knowledge_page` or create Knowledge model
- Add title/content/tags
- Add search
- Link knowledge pages to projects

### Done When

User can store and search reusable notes/guides.

### Avoid

- Do not overbuild rich text editing yet.

---

## Week 10 - Command Center MVP

### Goal

Make the Command Center useful.

### Tasks

- Create command message collection
- Create command action collection
- Build rule-based parser
- Support `add note:`
- Support `create task:`
- Support `log expense:`
- Show action preview
- Add Save/Edit/Cancel
- Save command history

### Done When

Typing `add note: today I fixed nginx` creates a Life Log after confirmation.

### Avoid

- Do not add AI yet.
- Do not skip the confirmation step.

---

## Week 11 - Search and Summary Basics

### Goal

Add global search and simple summaries.

### Tasks

- Add entry search
- Add task search
- Add project search
- Add transaction search
- Create global search endpoint
- Add search results to Command Center
- Add simple summary functions without AI

### Done When

User can search for records from the Command Center.

### Avoid

- Do not rely on AI for search yet.

---

## Week 12 - Server Manager and Integrations Placeholder

### Goal

Prepare for infrastructure and future integrations.

### Tasks

- Create Server Manager page
- Add server notes
- Add incident logs
- Add manual container records
- Add manual port records
- Create Integrations page
- Add planned integration records

### Done When

User can document server/integration setup manually.

### Avoid

- Do not run shell commands from the app yet.
- Do not trigger external webhooks yet.

---

## Backlog After Week 12

Future work:

- Receipts MVP
- File uploads
- OCR
- Google Calendar integration
- GitHub integration
- n8n integration
- Local AI/Ollama
- Outside AI through safe backend tools
- Mobile/PWA polish
- Backups
- Deployment behind Nginx Proxy Manager
