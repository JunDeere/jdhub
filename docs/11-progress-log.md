# 11 - Developer Journal

## Purpose

This is the running developer journal for JDHub.

Use this file to track what we worked on each day, what got finished, what changed because of discussion, and what the likely next steps are.

This is not meant to be a strict changelog. It is more like a project memory so the build direction does not get lost between sessions.

## Entry Style

Each entry should answer:

- What did we work on today?
- What did we finish?
- What changed based on discussion or feedback?
- What did we verify?
- What are the possible next steps?

New entries should go at the top of the journal section.

---

## Current Direction

```text
MVP 2 - Usability and Production Readiness
```

The current goal is not to add more major modules immediately.

The current goal is to make the existing JDHub modules easier to understand, safer to deploy, and more reliable to use.

Likely next build order:

1. Dashboard onboarding checklist
2. Empty-state actions
3. Planned module handling
4. Command Center command chips
5. Form validation and friendlier errors
6. User/admin basics
7. Data export/import/archive tools
8. Production hardening
9. Quality/testing pass

---

## 2026-08-23 - UTC Storage and Local Time Display

### What We Worked On

We standardized date and time handling across JDHub.

The owner wanted old and new records to follow UTC `+00:00` storage rules while the UI displays times using the user's detected local timezone.

### What We Finished

- Added shared backend UTC date helpers.
- Added shared frontend date/time formatting helpers.
- Converted `datetime-local` form values to UTC ISO strings before saving.
- Kept date-only form values as explicit UTC midnight dates.
- Updated reminders, scheduling, server incident records, tasks, finance, and projects.
- Updated dashboard, command history, knowledge pages, notifications, and module displays to use local browser formatting.
- Replaced remaining backend archive/completion timestamp updates with a shared UTC helper.

### What Changed From Discussion

The rule is now:

```text
Database storage: UTC Date values.
Date-only fields: YYYY-MM-DDT00:00:00.000Z.
Exact time fields: local browser input converted to UTC ISO before API save.
Display: browser-detected local timezone.
```

Existing records already stored as MongoDB Date values will continue to render in local time.

### Verification

- Backend syntax checks passed.
- Frontend production build passed.

### Possible Next Steps

- Add a visible timezone label in forms that use exact times.
- Add API tests for UTC parsing.
- Add migration checks if any old record was saved from an ambiguous server-local datetime string.

---

## 2026-07-06 - Life Log Renamed to Notes

### What We Worked On

We clarified the difference between Command Center notes and the old Life Log module.

The owner pointed out that `add note:` creates a record, but the sidebar did not have a Notes tab. The app had a Life Log tab instead, which made the current behavior feel disconnected.

### What We Finished

- Renamed the user-facing Life Log module to Notes.
- Updated the sidebar, topbar, dashboard card, module status label, and Notes page copy.
- Updated Command Center wording so `add note:` clearly saves to Notes.
- Added `log life:` as an optional command alias while keeping `add note:` as the main command.
- Kept the internal `life_log` data type for compatibility with existing records.
- Updated the MVP 2 roadmap wording from life log to notes where it describes current product behavior.

### What Changed From Discussion

The product direction is now:

```text
Notes = quick personal records, incidents, fixes, ideas, and daily notes.
Knowledge Base = reusable guides, references, and longer-term documentation.
```

This keeps the sidebar cleaner and makes the Command Center action easier to understand.

### Verification

- Backend syntax checks passed.
- Frontend production build passed.
- Docker Compose rebuilt and restarted the backend and frontend containers.
- Backend health returned `ok` and the database returned `connected`.
- Frontend returned HTTP `200` on `http://localhost:5173/`.

### Possible Next Steps

- Add empty-state action buttons that route users directly into creating their first note, task, project, or transaction.
- Consider renaming internal code from `LifeLog` and `life_log` later only if we plan a small migration/refactor.
- Add onboarding copy on Dashboard explaining the first three useful actions.

---

## 2026-07-06 - Notes Changed Into Notepad-Style Editor

### What We Worked On

We changed the Notes module direction from a record form into a notepad-style writing surface.

The owner wants Notes to feel closer to Windows 11 Notepad because JDHub may later become part of a local JDHub Windows experience.

### What We Finished

- Replaced the old title/category/project form with a tabbed note editor.
- Added a blank new-note tab and a plus button for starting another note.
- Made tab labels derive from the first line of the note.
- Kept tabs visually blank when the first line is blank or whitespace.
- Preserved leading whitespace/newlines in stored note content so blank-first-line tabs survive reloads.
- Kept notes stored through the existing entry API and `life_log` backend type for compatibility.

### What Changed From Discussion

Notes is now treated as the quick notepad area of JDHub.

Project-linked records, structured logs, and reusable documentation should stay separate:

```text
Notes = quick writing surface.
Tasks = actionable work.
Projects = build/maintenance tracking.
Knowledge Base = reusable guides and references.
```

### Verification

- Backend syntax checks passed.
- Frontend production build passed.
- Docker Compose rebuilt and restarted the backend and frontend containers.
- Backend health returned `ok` and the database returned `connected`.
- Frontend returned HTTP `200` on `http://localhost:5173/`.

### Possible Next Steps

- Add unsaved-change warnings when switching tabs.
- Add close buttons on tabs.
- Add keyboard shortcuts such as Ctrl+S for save and Ctrl+N for new note.
- Decide later whether to migrate internal names from `LifeLog`/`life_log` to `Notes`.

---

## 2026-07-06 - Notes Autosave and Empty Tabs

### What We Worked On

We adjusted Notes to behave more like a notepad app instead of a form with an explicit save action.

The owner wanted notes to save automatically, remove the Save button, keep Clear, and allow the plus button to open a new tab even when the current tab is empty.

### What We Finished

- Removed the Save button from the Notes toolbar.
- Added autosave after typing.
- Changed the status pill to show `Autosaving...` while a save is in progress.
- Kept the Clear action in the toolbar.
- Made the plus button always create a new blank local tab.
- Allowed multiple blank tabs in the UI before they are saved.
- Kept brand-new empty tabs local until content is typed.
- Allowed saved notes to be cleared to blank content.

### What Changed From Discussion

Notes should now feel closer to a lightweight desktop notepad:

```text
Open tab -> type -> autosave.
Click plus -> always get another blank tab.
Clear -> empties the active note.
```

### Verification

- Backend syntax checks passed.
- Frontend production build passed.
- Docker Compose rebuilt and restarted the backend and frontend containers.
- Backend health returned `ok` and the database returned `connected`.
- Frontend returned HTTP `200` on `http://localhost:5173/`.

### Possible Next Steps

- Add tab close buttons.
- Add Ctrl+S as a manual "save now" shortcut even without a visible Save button.
- Add Ctrl+N for a new tab.
- Add a small unsaved/local indicator for blank tabs that have not reached the database yet.

---

## 2026-07-06 - MVP 2 Usability Pass Started

### What We Worked On

We started the MVP 2 usability work so a user can understand what to do after signing in.

The focus was on making the Dashboard less empty and making Command Center easier to try without reading separate notes.

### What We Finished

- Added a Dashboard onboarding checklist.
- Added Dashboard empty-state action buttons for notes, tasks, reminders, schedule, finance, projects, and knowledge pages.
- Wired Dashboard actions to navigate directly to the relevant module.
- Disabled planned sidebar modules for Files, Receipts, and Automations so they do not look fully usable yet.
- Replaced plain Command Center examples with command chips that show the command and what it creates.

### What Changed From Discussion

MVP 2 usability should start with low-friction first actions before deeper user/admin features.

The product should guide users toward:

```text
Write a note.
Create a task.
Add a project.
Log a transaction.
Try Command Center.
```

### Verification

- Frontend production build passed.
- Backend syntax checks passed.
- Docker Compose rebuilt and restarted the backend and frontend containers.
- Backend health returned `ok` and the database returned `connected`.
- Frontend returned HTTP `200` on `http://localhost:5173/`.

### Possible Next Steps

- Add module-level "what to do next" panels to Tasks, Projects, Finance, and Knowledge Base.
- Add friendlier validation messages on forms.
- Add consistent inline save confirmations across modules.

---

## 2026-07-06 - Dashboard Guidance Made Collapsible

### What We Worked On

We reduced the visual weight of the Dashboard onboarding checklist.

The owner pointed out that many users will skip onboarding, so the guidance should not take too much screen space.

### What We Finished

- Changed the Dashboard onboarding block into a compact notification-style row.
- Made the guidance expandable only when clicked.
- Persisted the expanded/collapsed state in `localStorage`.
- Kept the same first-action links available when expanded.
- Reduced the expanded checklist height and grid spacing.

### What Changed From Discussion

Dashboard guidance should behave more like a notification or helper panel:

```text
Collapsed by default.
Available when needed.
Out of the way for regular use.
```

### Verification

- Frontend production build passed.
- Backend syntax check passed.
- Docker Compose rebuilt and restarted the backend and frontend containers.
- Backend health returned `ok` and the database returned `connected`.
- Frontend returned HTTP `200` on `http://localhost:5173/`.

### Possible Next Steps

- Add a real topbar notification tray later for system messages, reminders, and setup prompts.
- Add a dismiss action for users who never want to see setup guidance.
- Move one-time setup prompts into a notification center once that module exists.

---

## 2026-07-06 - Notifications Inbox Added

### What We Worked On

We added the first Notifications module as the next usability piece after collapsing Dashboard guidance.

The goal is to give setup prompts, reminders, and system notices a dedicated place instead of forcing everything onto the Dashboard.

### What We Finished

- Added `Core > Notifications` to the sidebar.
- Built a Notifications inbox page.
- Added derived setup prompts for first note, task, project, and transaction.
- Added upcoming reminder notices.
- Added system health notice from API/database health.
- Added a planned-module notice for disabled Files, Receipts, and Automations.
- Added summary counts for setup prompts, reminders, and system notices.

### What Changed From Discussion

Notifications should become the system-level place for:

```text
Setup prompts.
Reminder alerts.
Autosave or sync issues.
Deployment/system notices.
```

This first version is derived from existing Dashboard and health data. It does not create a persistent notification table yet.

### Verification

- Frontend production build passed.
- Backend syntax check passed.
- Docker Compose rebuilt and restarted the backend and frontend containers.
- Backend health returned `ok` and the database returned `connected`.
- Frontend returned HTTP `200` on `http://localhost:5173/`.

### Possible Next Steps

- Add a persistent notification model once we need dismiss/read states.
- Add notification badges in the sidebar/topbar.
- Route failed autosaves from Notes into Notifications.
- Add user-controlled notification preferences later.

---

## 2026-07-06 - Notifications Moved to Topbar

### What We Worked On

We corrected the Notifications direction after feedback.

The owner wanted notifications like a Facebook-style topbar bell, not a full sidebar module/page.

### What We Finished

- Removed `Notifications` from the sidebar.
- Removed the standalone Notifications page route.
- Added a topbar bell button with an active-count badge.
- Added a dropdown notification menu.
- Kept setup prompts, reminder notices, and system status notices inside the dropdown.
- Actions in the dropdown still navigate to the relevant module.

### What Changed From Discussion

Notifications should be lightweight and always reachable from the header:

```text
Bell in topbar.
Dropdown on click.
No full module page for now.
```

### Verification

- Frontend production build passed.
- Backend syntax check passed.
- Confirmed no stale Notifications page imports/routes remained.
- Docker Compose rebuilt and restarted the backend and frontend containers.
- Backend health returned `ok` and the database returned `connected`.
- Frontend returned HTTP `200` on `http://localhost:5173/`.

### Possible Next Steps

- Add click-outside-to-close behavior.
- Add read/dismiss state once notifications become persistent.
- Add failed Notes autosave notices into the dropdown.

---

## 2026-07-06 - MongoDB Persistence Confirmed

### What We Worked On

We checked whether JDHub data survives Docker container replacement.

The owner asked if database storage was temporary and whether Docker volumes or bind mounts should be used.

### What We Finished

- Confirmed `docker-compose.yml` already mounts MongoDB data to a named Docker volume.
- Confirmed the active Compose config maps `jdhub_mongo-data` to `/data/db`.
- Confirmed the `jdhub_mongo-data` volume exists locally.
- Added README documentation explaining which Docker commands preserve or delete the database.
- Added a basic `mongodump` backup command to the README.
- Updated the MVP 2 roadmap persistence/backup items.

### What Changed From Discussion

Current behavior is:

```text
docker compose up -d --build = data survives.
docker compose down = data survives.
docker compose down -v = data is deleted.
```

### Verification

- `docker compose config` shows `mongo-data` mounted to `/data/db`.
- `docker volume ls` shows `jdhub_mongo-data`.

### Possible Next Steps

- Add a scripted backup command under `scripts/`.
- Add restore instructions next to the backup command.
- Add production backup scheduling notes.

---

## 2026-07-06 - Developer Journal Added

### What We Worked On

We decided that the project needs a journal-style progress log, not just a formal status tracker.

The goal is to capture the working conversation: what was done, what was finished, what direction changed, and what could come next based on the owner's feedback.

### What We Finished

- Added this developer journal document.
- Linked the journal from the main README and planning docs.
- Reframed progress tracking as a day-by-day project memory.

### What Changed From Discussion

The progress log should read more like:

```text
Today we did this.
We finished this part.
This changed because of feedback.
Possible next steps are these.
```

It should not only be a technical changelog.

### Verification

- Confirmed references to this document exist in the README and planning docs.

### Possible Next Steps

- Keep adding new dated entries after meaningful work.
- Add a short "Current blockers" section if the project starts having unresolved decisions.
- Add screenshots or links later if visual changes need to be remembered.

---

## 2026-07-06 - Sidebar and Navigation Cleanup

### What We Worked On

We cleaned up the app navigation because the UI still looked like it was tied to the original sprint plan.

The sidebar had labels like `Week 4 done` and `Week 12 active`, which did not make sense for real users because those were build-plan labels, not product status labels.

### What We Finished

- Removed sprint/week labels from the sidebar.
- Replaced sprint-style page labels with stable module labels.
- Removed duplicate module titles inside pages when the topbar already shows the current module.
- Moved module readiness/status information from Dashboard into `System > Module Status`.
- Added a collapsible sidebar.
- Added icons to the sidebar using `lucide-react`.
- Made collapsed sidebar preference persist in `localStorage`.

### What Changed From Discussion

The owner pointed out that:

- The sidebar should stay clean.
- Repeated module titles were unnecessary.
- Module status belongs in the System area because it is system/admin information.
- A minimized sidebar should use icons instead of text-only initials.

Those decisions shaped the cleanup.

### Verification

- Frontend production build passed.
- Docker Compose rebuilt and restarted.
- Backend health returned `ok`.
- Frontend returned `200`.
- Verified the frontend bundle no longer included `Week` text.

### Possible Next Steps

- Review sidebar behavior visually on smaller screens.
- Consider adding tooltips with richer descriptions later.
- Add admin-only access to `Module Status` once roles exist.

---

## 2026-07-06 - MVP 2 Roadmap Added

### What We Worked On

We reviewed whether JDHub was ready for people to use without a tutorial.

The conclusion was that JDHub is deployable and usable as a private MVP, but not yet self-explanatory enough for general users.

### What We Finished

- Added `docs/10-mvp2-roadmap.md`.
- Updated `docs/07-build-milestones.md` with MVP 1 progress.
- Updated `docs/08-weekly-sprint-plan.md` with MVP 2 workstreams.
- Updated `README.md` to point to the new roadmap.

### What Changed From Discussion

The owner listed the main gaps:

- No onboarding
- No empty-state actions
- Command Center syntax is not obvious enough
- Planned modules are visible even when not implemented
- No role/user setup flow
- Validation needs polish
- Production hardening is still needed

Those became the MVP 2 workstreams:

- Usability
- User/Admin Basics
- Data Management
- Production Readiness
- Quality

### Verification

- Confirmed roadmap references exist in docs and README.

### Possible Next Steps

- Start with Dashboard onboarding.
- Add empty-state action buttons.
- Hide or disable planned modules until implemented.
- Improve Command Center examples and command chips.

---

## 2026-07-06 - MVP 1 Pushed to GitHub

### What We Worked On

We pushed the completed JDHub MVP 1 implementation to GitHub.

This made the current app state available in the remote repository instead of only in the local workspace.

### What We Finished

- Staged frontend, backend, Docker Compose, and config files.
- Committed the MVP implementation.
- Pushed `main` to `origin`.

### Verification

- Frontend production build passed.
- Backend syntax check passed.
- Push to `https://github.com/JunDeere/jdhub.git` succeeded.

### Decisions

- Keep the current branch as `main`.
- Treat the pushed app as the MVP 1 foundation.

### Possible Next Steps

- Continue development from MVP 2.
- Commit future work in smaller focused chunks.

---

## Journal Maintenance

When meaningful work is completed:

1. Add a new dated entry near the top.
2. Write it in plain language.
3. Include what was finished.
4. Include feedback-driven decisions.
5. Include verification only when something was actually checked.
6. End with possible next steps.
