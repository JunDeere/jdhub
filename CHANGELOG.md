# Changelog

All notable JDHub changes are recorded here. JDHub follows Semantic Versioning
and remains in the `0.x` pre-stable phase.

## Unreleased

- Final documentation review and release verification before the next push.
- Added administrator-controlled per-account email verification policies while
  retaining the server-wide master switch and mandatory protection for the
  primary administrator.
- Added chunked large-file uploads so public uploads remain below Cloudflare's
  per-request body limit while preserving JDHub quota and safety inspection.
- Fixed public share URLs so anonymous visitors can load the neutral share page;
  the backend still rejects invalid, revoked, and expired tokens.

## 0.2.0-beta.1 - 2026-10-05

### Added

- Admin-managed user accounts, account status controls, email verification, and
  security monitoring foundations.
- A private cloud files workspace with per-user storage, upload inspection,
  folders, direct uploads, drag-and-drop movement, multi-selection, and
  time-limited public sharing.
- Finance forecasts, financing records, projected balances, and planned payment
  status controls kept separate from actual transactions.
- Persistent assistant improvements, conversation history, structured command
  previews, module-aware context, and live module refresh behavior.
- Windows Notepad backup bridge with read-only desktop notes and editable web
  copies.
- Demo-account data and safer production deployment configuration.

### Changed

- Redesigned Dashboard, Projects, Tasks, Finance, Files, and application
  navigation for clearer desktop and mobile use.
- Connected independent tasks with optional projects and enabled task movement
  between workflow statuses.
- Consolidated reminders into app-wide attention signals and receipts into the
  Finance module.
- Restricted account creation to administrators by default.

### Security

- Added safer production defaults, authentication rate limiting, security
  headers, environment-based CORS, upload inspection, private storage paths,
  and expiring revocable share links.

## 0.1.0 - 2026-07-06

### Added

- Initial deployable JDHub MVP with authentication, core personal and work
  modules, Command Center, MongoDB persistence, and Docker Compose support.
