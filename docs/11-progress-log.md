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

## 2026-10-08 - Finance Dashboard and Linked Financing Payments

### What We Worked On

We expanded Finance from separate transaction and financing displays into a
more useful dashboard and restored the missing relationship between them.

### What We Finished

- Added an always-visible finance summary for current cash, planned payments,
  known financing balances, monthly installments, and projected cash.
- Expanded the desktop financing workspace while retaining mobile cards.
- Added an optional financing account to expense transactions.
- Linked payments now reduce the selected financing balance and payments-left
  count; editing a payment reverses and reapplies the correct adjustment.
- Displayed the linked financing account in transaction history.
- Added backend tests for financing payment balance behavior.

### Verification

- All backend tests passed.
- Frontend lint and production build passed.
- Git whitespace validation passed.

### Possible Next Steps

- Add transaction deletion with the same financing rollback behavior.
- Add a dedicated financing payment history and reconciliation view.

---

## 2026-10-05 - Anonymous Share Route Repaired

### What We Worked On

We investigated valid `share.jdeere.net/s/<token>` links returning a generic
Nginx 404 in private browsing.

### What We Finished

- Confirmed public shares do not require a JDHub login.
- Corrected the share-host Nginx fallback so `/s/<token>` loads the neutral
  public-share application shell.
- Kept authorization in the public-share API, where invalid, revoked, and
  expired tokens still return unavailable.

### Verification

- Confirmed the public share root was reachable while `/s/<token>` was being
  rejected by the frontend Nginx fallback.
- This routing correction is local and still requires a frontend rebuild and
  public incognito verification.

---

## 2026-10-05 - Cloudflare-Safe Large File Uploads

### What We Worked On

We traced large File workspace uploads that were being reset before JDHub could
return an application error.

### What We Finished

- Confirmed JDHub's Nginx and Multer configuration did not impose the observed
  whole-file limit.
- Identified Cloudflare's plan-level request-body limit on the public hostname.
- Added a server-created upload session for large files.
- Split files larger than 64 MB into sequential 16 MB requests.
- Reassembled chunks only inside the authenticated user's private incoming area.
- Preserved folder selection, project metadata, storage quotas, executable
  inspection, SHA-256 hashing, and final upload progress.
- Added 24-hour cleanup metadata for abandoned upload sessions.
- Improved the interrupted-connection message shown to users.

### Verification

- Backend automated tests passed: 21 of 21.
- Frontend ESLint passed.
- Frontend production build passed.
- Backend syntax and Git whitespace checks passed.
- A full large-file upload through the public Cloudflare hostname still requires
  deployment and browser verification.
- This change is local and has not been committed, pushed, or deployed.

### Possible Next Steps

- Add automatic retry for an interrupted individual chunk.
- Add explicit pause/resume controls if multi-gigabyte uploads become common.

---

## 2026-10-05 - Per-Account Email Verification Controls

### What We Worked On

We added administrator control over whether individual member accounts require
an emailed sign-in code on untrusted browsers.

### What We Finished

- Kept `EMAIL_AUTH_REQUIRED` as the server-wide master switch.
- Added an account-level email-verification policy that defaults to required.
- Added a toggle to each member row in Administration > Users.
- Added the same policy to the Create member form.
- Kept the demo account exempt and prevented email verification from being
  disabled for the primary administrator.
- Revoked an account's existing trusted browsers when verification is enabled,
  ensuring its next sign-in performs the email challenge.
- Recorded policy changes in the security-event log.

### Verification

- Added backend policy tests for the global switch, member override, and demo
  exemption.
- This change is local and has not been committed, pushed, or deployed.

### Possible Next Steps

- Add temporary verification exemptions with automatic expiry if needed.
- Add an account-security audit filter to the Administration view.

---

## 2026-10-05 - Product Versioning Established

### What We Worked On

We replaced the conflicting backend `1.0.0` and frontend `0.0.0` placeholders
with one JDHub product version before preparing the next push.

### What We Finished

- Set the current development version to `0.2.0-beta.1`.
- Added a canonical root `VERSION` file.
- Aligned the frontend and backend package manifests and lockfiles.
- Added a Semantic Versioning and release policy.
- Added a changelog covering the MVP 1 foundation and current MVP 2 prerelease.
- Linked the version and release documents from the README.

### What Changed From Discussion

MVP 2 has substantial working functionality, but it is still undergoing review
and should not be presented as stable `1.0.0`. A beta version communicates that
state more honestly while giving future commits and deployments clear release
identities.

### Verification

- Confirmed the repository previously had no Git version tags.
- Confirmed all JDHub package manifests now use the same product version.
- No commit, tag, push, or server deployment was performed.

### Possible Next Steps

- Finish synchronizing the roadmap and operational documentation.
- Run the full release checks before staging.
- Create the first annotated version tag only after the release commit is
  reviewed and approved.

---

## 2026-10-05 - MVP 2 Consolidation Checkpoint

### What We Worked On

We reviewed and expanded JDHub as a multi-user private command center instead of
leaving the modules as disconnected MVP forms. The work focused on making the
product safer, more responsive, and more natural to use before the next push.

### What We Finished

#### Administration and Security

- Replaced public account creation with admin-managed member accounts.
- Added account listing plus member enable/disable controls.
- Added active account status enforcement and protected administrator access.
- Added email verification for sign-ins from new browsers using configured SMTP.
- Added trusted-browser, trusted-network, and security-event views.
- Kept IP information as a monitoring signal rather than an authentication
  substitute.

#### Files Workspace

- Turned Files into a private cloud-style workspace backed by server storage.
- Added user-isolated physical storage, a 300 GB shared ceiling, and a default
  10 GB member allowance; administrators see combined pool usage.
- Added upload inspection, executable-content detection, hashing, and private
  incoming-file handling.
- Added folders, inline create/rename behavior, current-folder uploads, external
  drag-and-drop uploads, upload progress, full-name tooltips, multi-selection,
  and internal drag-to-folder movement.
- Added file and folder downloads, including folder archive downloads.
- Added restricted sharing and revocable public links with a maximum 24-hour
  lifetime.
- Kept the public share experience neutral so it does not disclose private JDHub
  branding or server details.

#### Tasks, Projects, and Live Updates

- Redesigned Tasks and Projects into clearer operational workspaces.
- Kept tasks independent while allowing an optional project relationship.
- Added task workflow views and drag-and-drop movement between statuses,
  including visible completed work.
- Added app-wide refresh notifications so assistant-created or edited records
  update relevant modules without a full browser refresh.
- Added polite assistant check-ins for due and overdue tasks, with validated
  previews before status changes are saved.

#### Finance and Module Organization

- Added forecast and financing views alongside actual finance transactions.
- Added forecast resolution states without assuming an overdue payment was paid.
- Folded receipt handling into Finance instead of keeping a duplicate sidebar
  module.
- Kept Integrations for future external-system connections and renamed Server
  Manager to the more general admin-only Infrastructure area.
- Moved Files under Tools and kept Automations visibly planned rather than
  presenting it as complete.

#### Assistant and Interface

- Added conversation history and consistent structured action validation.
- Added module-aware context and live cross-module record refresh behavior.
- Made the assistant open at the newest message and improved its floating and
  docked layouts.
- Added individual privacy controls for money-related Dashboard summaries.
- Improved responsive layouts, branding, navigation, empty states, and module
  presentation across the application.

### What Changed From Discussion

The current product direction is:

```text
JDHub should feel like one connected private workspace. Modules may remain
independent, but shared records, assistant actions, permissions, and live updates
must behave consistently across the application.
```

Files should behave like a familiar desktop/cloud file manager. Account creation
belongs to administrators. Public sharing must reveal only the shared content,
not internal infrastructure or private application details.

### Verification

- Backend automated tests passed: 19 of 19.
- Frontend ESLint passed.
- Frontend production build passed.
- Version consistency and Git whitespace checks passed.
- Gmail accepted a local SMTP test message during configuration validation.
- Current documentation/versioning work remains local and uncommitted.

### Remaining Before the Next Push

- Perform a final browser walkthrough of the highest-risk workflows:
  authentication, account administration, file upload/move/share/download,
  assistant-created records, task movement, and finance forecast resolution.
- Review environment examples without exposing local or server secrets.
- Review the complete staged file list and exclude unrelated Valheim directories.
- Decide whether `0.2.0-beta.1` is ready to tag after the release commit.
- Deploy only when explicitly requested after the local release is approved.

### Possible Next Steps

- Add password change and account recovery flows.
- Make Module Status and appropriate settings admin-only.
- Add frontend interaction tests for the new workflows.
- Add export, import, archive, restore, and documented disaster-recovery tools.

---

## 2026-09-27 - Windows Notepad Backup Bridge

### What We Worked On

We made Windows 11 Notepad the primary writing app while keeping JDHub Notes as a private backup and optional web editor.

### What We Finished

- Added a one-way Windows Notepad-to-JDHub bridge that never writes into Notepad session files.
- Added read-only desktop backup tabs inside Notes.
- Added **Make editable web copy** so a desktop backup can intentionally become a separate normal JDHub note.
- Preserved the existing tabbed web editor, autosave, clear, and archive behavior for web-created notes.
- Added raw Notepad session snapshots so recovery does not depend only on the current decoder.
- Added state hashing so unchanged sessions are not duplicated.
- Added a dedicated bridge credential that cannot access normal JDHub routes.
- Added a Windows sign-in task that keeps the bridge running in the background.

### Verification

- Decoded all six current Notepad tab records without printing note content.
- Imported four non-empty desktop notes and retained two empty tabs in the raw snapshot.
- Stored all 18 related Notepad session files in one recovery snapshot.
- Confirmed a repeated sync returned unchanged and did not duplicate data.
- Frontend lint and production build passed.
- Backend smoke tests and syntax checks passed.
- Docker backend, frontend, and MongoDB health checks passed.

### Possible Next Steps

- Add an in-app recovery browser for older raw snapshots.
- Add a manual backup-now button that talks to the local bridge.
- Add retention controls after deciding how many historical snapshots to keep.

---

## 2026-09-27 - Finance Forecast and Financing Overview

### What We Worked On

We separated planned cash flow from completed finance transactions and added private, user-scoped forecasts.

### What We Finished

- Added a user-scoped Finance Forecast model and protected API.
- Added a running-balance schedule starting from a user-provided balance.
- Supported grouped date-range payments alongside individual scheduled payments.
- Added planned, completed, and skipped status controls; skipped items are removed from projected totals.
- Added a Financing overview for installment and loan records.
- Kept forecast entries separate from actual monthly income, expense, and net totals.
- Added an idempotent forecast seed script. The tracked seed now uses synthetic examples only; personal forecasts belong in the private database.

### Verification

- Frontend lint passed.
- Frontend production build passed.
- Backend smoke tests passed.
- Backend syntax checks passed.
- Verified stored forecast entries, financing records, and projected totals. Personal financial details are omitted from this journal.

### Possible Next Steps

- Add manual forecast-entry creation and editing.
- Convert completed forecast entries into actual transactions with confirmation.
- Add recurring schedule generation for future forecast periods.

---

## 2026-09-24 - Unified JDHub Assistant and Command Center

### What We Worked On

We replaced the separate topbar command shortcut, New Command form, and Ask AI form with one persistent JDHub Assistant.

### What We Finished

- Changed the topbar command placeholder into a working assistant prompt.
- Added a minimized bottom-right assistant launcher across modules.
- Added a Messenger-style floating chat as the first open state.
- Added an integrated split view with the current module on the left and the assistant on the right.
- Added a visible divider for resizing the integrated assistant between 320 and 720 pixels.
- Kept the integrated assistant visually separate from the page while making its full header and composer remain visible.
- Added independent assistant scrolling plus a History drawer in both floating and integrated views.
- Made minimize return the integrated assistant to floating chat and close return it to the Ask JDHub launcher.
- Kept the assistant mounted while navigating so its conversation and pending preview remain available.
- Rebuilt Command Center around the same assistant instead of rendering a duplicate chat.
- Removed the separate New Command form.
- Routed supported command prefixes through the existing preview-and-confirm flow.
- Routed normal questions through Ask AI.
- Reduced the Command Center side panel to global search and recent command history.
- Added responsive behavior that gives the assistant the full content area on smaller screens.

### What Changed From Discussion

The app now follows this rule:

```text
JDHub has one assistant conversation. Outside Command Center it moves from launcher, to floating chat, to a resizable right-side dock. The full chat-and-history layout exists only in Command Center.
```

### Verification

- Frontend lint passed.
- Frontend production build passed.
- Backend smoke tests passed.
- Docker rebuild passed.
- Backend health and database connection passed.

### Possible Next Steps

- Persist AI conversation history in the backend.
- Add links from search results to their source modules.
- Add assistant preferences and scoped context controls.

---

## 2026-08-26 - Mobile Sidebar Drawer

### What We Worked On

We fixed the mobile navigation behavior.

The owner pointed out that the sidebar should not sit at the top of the mobile page. It should be hidden by default and opened from a floating control.

### What We Finished

- Added a separate mobile sidebar open state.
- Added a floating mobile navigation button.
- Changed the mobile sidebar into a fixed drawer that slides in from the left.
- Added a backdrop that closes the drawer.
- Made the existing sidebar arrow close the drawer on mobile.
- Kept the desktop sidebar collapse behavior unchanged.
- Closed the mobile drawer automatically after selecting a navigation item.

### What Changed From Discussion

Mobile navigation is now treated as a drawer, not a stacked page section.

### Verification

- Frontend production build passed.
- Docker Compose frontend rebuild/restart passed.
- Browser mobile viewport check passed:
  - Drawer hidden off-screen by default.
  - Floating button visible at mid-left.
  - Drawer opens to the left edge.
  - Sidebar arrow closes the drawer.
  - Reminders is not present in the sidebar.

### Possible Next Steps

- Add swipe-to-close later if needed.
- Add read/dismiss state for attention notifications.
- Commit the current MVP 2 checkpoint.

---

## 2026-08-26 - Reminders Folded Into App Attention

### What We Worked On

We changed the reminder direction based on product feedback.

The owner pointed out that reminders should not be a separate module users must visit. Instead, JDHub should notice important things across the app, such as tasks due today and schedule items happening today, then report them through the app-wide notification/attention layer.

### What We Finished

- Removed Reminders from the sidebar navigation.
- Removed the standalone frontend Reminders page and frontend reminders API wrapper.
- Added shared frontend attention-signal logic.
- Added due-task data to the Dashboard API.
- Changed the Dashboard reminders panel into `Today's Attention`.
- Made the topbar notification bell include:
  - Tasks due today
  - Overdue tasks
  - Schedule items happening today
  - Existing explicit reminder records that are due
  - Setup prompts
  - System health status
- Changed Module Status from `Reminders` to `Attention`.
- Updated the README, roadmap, and MCP plan to reflect the new model.

### What Changed From Discussion

The new rule is:

```text
Reminders are not a user-facing module. They are an app-wide attention behavior fed by tasks, scheduling, and internal reminder records.
```

The backend reminder route still exists for internal/future compatibility, but the user-facing app no longer treats it as a separate module.

### Verification

- Backend syntax checks passed.
- Frontend production build passed.

### Possible Next Steps

- Add read/dismiss state for attention items.
- Add notification preferences.
- Add task-level reminder offsets, such as due date, one day before, or custom.
- Add MCP read tools for attention signals.

---

## 2026-08-25 - Production Hardening and MCP Capability Map

### What We Worked On

We shifted the next MVP 2 priority toward production readiness because JDHub stores real personal data and will later be exposed to AI clients through an MCP-style integration.

The goal was to harden the current HTTP API and define the functions a future MCP server should wrap.

### What We Finished

- Added Helmet security headers.
- Added auth route rate limiting.
- Added environment-based CORS configuration.
- Added Docker Compose healthchecks for backend, frontend, and MongoDB.
- Added a production Compose override.
- Expanded environment examples with JWT, CORS, trust proxy, and auth rate-limit settings.
- Added authenticated MCP capability discovery at `/api/mcp/capabilities`.
- Documented the planned MCP tool/function surface for current modules.
- Updated the README, roadmap, and developer journal.

### What Changed From Discussion

The owner wants JDHub to eventually work with AI through an API or MCP implementation.

The decision for now is:

```text
MCP should wrap JDHub's authenticated API, not connect directly to MongoDB.
```

That keeps permissions, validation, UTC date handling, and future audit behavior in one place.

### Verification

- Backend syntax checks passed.
- Frontend production build passed.
- Local Docker Compose config validation passed.
- Production Docker Compose override validation passed when required production environment values were supplied.
- Backend production dependency audit passed with zero reported vulnerabilities after `npm audit fix`.

### Possible Next Steps

- Add user/admin roles and scoped API tokens for MCP clients.
- Add read-only MCP server package.
- Add data export and backup endpoints.
- Add API smoke tests for the hardened routes.

---

## 2026-08-23 - MVP 2 Form Validation Pass

### What We Worked On

We started the next MVP 2 usability item: validation, loading, and confirmation polish.

The goal was to stop users from hitting backend errors for simple missing fields and to make form mistakes clear before a save request is sent.

### What We Finished

- Added a shared frontend form validation helper.
- Added client-side required-field checks for:
  - Tasks
  - Projects
  - Finance
  - Reminders
  - Scheduling
  - Knowledge Base
  - Integrations
  - Server Manager
- Added friendly field-level error text.
- Added invalid-field styling.
- Added date ordering checks for project target dates and schedule end times.
- Added finance amount and currency-code validation.
- Added server port range validation.

### What Changed From Discussion

This work follows the MVP 2 build order after onboarding, empty states, planned module handling, command chips, notifications, persistence, and UTC/local time handling.

Validation is now treated as a user-facing feature, not only a backend safety check.

### Verification

- Frontend production build passed.

### Possible Next Steps

- Run and confirm the frontend build.
- Add profile/account basics.
- Start export/import/archive data management.
- Add API smoke tests for the core create/update flows.

---

## Current Direction

```text
MVP 2 - Usability and Production Readiness
```

The current goal is not to add more major modules immediately.

The current goal is to make the existing JDHub modules easier to understand, safer to deploy, and more reliable to use.

Likely next build order:

1. Finish production hardening
2. MCP/API capability foundation
3. User/admin basics
4. Data export/import/archive tools
5. Quality/testing pass

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
