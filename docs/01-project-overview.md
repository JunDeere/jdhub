# 01 - Project Overview

## Project Name

JDHub

## Core Identity

JDHub is a private personal command center.

It is not just a journal, task manager, or notes app. It is a modular personal system that connects personal logs, tasks, reminders, scheduling, finance, projects, knowledge, files, receipts, automations, and server management into one private dashboard.

The Command Center/chat interface is intended to become the main input layer of the app. Users should be able to add, search, summarize, and manage information from one place.

## Main Goal

Build a personal multi-tool system that helps manage life, work, projects, finances, infrastructure, and future automations.

The first goal is not to make everything advanced immediately. The first goal is to build a strong core foundation that can be expanded later.

## Why This Project Exists

JDHub exists because personal information is usually scattered across many places:

- Notes
- Task apps
- Calendar apps
- Finance trackers
- Receipts
- Project folders
- Automation tools
- Server notes
- GitHub repositories
- Chatbots

JDHub should become one private home base where these things can be organized and connected.

## What JDHub Should Feel Like

JDHub should feel like a private admin panel for personal life and personal infrastructure.

It should feel like:

```text
Personal dashboard + command center + knowledge base + project tracker + finance tracker + automation hub
```

## What JDHub Is Not

JDHub is not meant to start as:

- A public SaaS product
- A polished commercial app
- A full accounting system
- A full calendar replacement
- A full cloud storage product
- A full AI platform
- A copy of Notion, Google Calendar, Todoist, or ChatGPT

It may connect to outside systems later, but the core should be owned and controlled by JDHub first.

## Target User

The first target user is the owner/developer.

The system should be designed around personal use first:

- Personal tasks
- Personal projects
- Personal finance
- Personal server notes
- Personal scheduling
- Personal automations
- Personal logs

## Build Philosophy

Core first. Integrations later.

The MVP should focus on building the core modules and the Command Center. Advanced integrations, outside AI, local AI, Google Calendar, GitHub references, and automation tool control should be future phases.

## Planned Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Main Database: MongoDB
- Optional SQL Later: PostgreSQL or MySQL for strict/important data
- Styling: Tailwind CSS
- Containerization: Docker Compose
- AI/Command Layer: Rule-based command parser first, local or outside AI later

## Main Navigation

```text
Dashboard

Command Center
- Chat
- Command History
- Saved Outputs

Personal
- Life Log
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

## First MVP Definition

The first MVP should prove that JDHub can:

1. Run as a React + Node + MongoDB app.
2. Save and display personal records.
3. Create life logs, tasks, and finance transactions.
4. Use the Command Center to create records from typed commands.
5. Show recent activity on a dashboard.
6. Keep the structure ready for future integrations.

## Long-Term Vision

JDHub should eventually become a private personal operating system where the user can ask:

- What should I focus on today?
- What happened last time my server broke?
- How much did I spend this month?
- What projects are active?
- What reminders are coming up?
- What files are related to this project?
- What automations are running?
- What is on my schedule?

The system should answer using JDHub data first, then integrations later.
