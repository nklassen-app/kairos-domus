# Household Projects App — MVP Design & Implementation Specification

> **Reviewed 2026-09-13 (the assay).** This spec arrived as `kairos-domus/kairos-domus.md`
> (moved here, to `docs/DOMUS_DESIGN.md`, when DE1 scaffolded the folder on 2026-09-19)
> and went through the Kairos Assay Funnel the same day as the Library idea
> *Household projects tracker* (captured 2026-08-16), which N. advanced and
> activated under the program *Managing home support team*. The review kept
> the pipeline, the effort/duration distinction, manual ordering, vendors as
> entities and the calendar-ID rule, and changed the following:
>
> 1. **The annual budget is the spine, not an afterthought.** N.'s stated pain
>    is overspending and unattended issues against a yearly home-improvement
>    budget. A `Budget {year, amount}` record and a committed / spent /
>    remaining line at the top of the app are added (§4, §6, §13, Rule 10).
> 2. **Google Calendar is deferred**, not slice 5. It is story D5 in the
>    Kairos backlog, gated on a month of scheduling by hand and on a spike of
>    OAuth from a public Pages origin (§12).
> 3. **Dependencies are deferred** to story D4, built only if the migration
>    surfaces a project that waited on another unnoticed (§9).
> 4. **The stack is decided:** the Kairos Floor pattern — one `index.html`,
>    one JSON document in `localStorage`, network-first service worker,
>    public GitHub Pages repo, Capacitor shell. No relational database, no
>    server, no token storage until D5 (§20).
> 5. **The monthly vendor list is a first-class output** (story D2): the
>    view that replaces the document N. writes by hand each month.
> 6. **The slices (§26) are replaced by the stories** in
>    `kairos-system/BACKLOG.md`, epic *The household projects backlog*
>    (DE1, D1, DE3, D2, DE2, D3, D4, D5). The stories are the plan; this
>    document is their input. Sensitivity: vendor contacts are public
>    information; project data lives on the device only.
>
> Sections below carry a *Reviewed:* line where the review changed them.

## 1. Purpose

Build a mobile-first app for managing **household projects** as a persistent, prioritized pipeline from "we should do this" to completed work.

The app is intentionally **not** a general-purpose task manager or household chore app. Its core purpose is to make it easy to:

1. Capture household projects.
2. Maintain a prioritized backlog.
3. Understand effort, cost, dependencies, and ownership.
4. Commit to projects by activating them.
5. Schedule activated projects.
6. Create corresponding Google Calendar events.
7. See all currently activated/scheduled projects in one dashboard.
8. Mark projects complete and retain their history.

### Core product hypothesis

A persistent, prioritized household project backlog can reduce the gap between:

> "We should do that sometime."

and

> "That project is actually getting done."

The MVP should optimize for **low friction, visibility, and commitment**, not feature breadth.

---

# 2. Core Concepts

## 2.1 Project lifecycle

Use the following lifecycle:

```text
BACKLOG
   |
   | activate
   v
ACTIVATED
   |
   | schedule
   v
SCHEDULED
   |
   | work begins
   v
IN PROGRESS
   |
   | complete
   v
COMPLETED
```

Projects may also be:

- **BLOCKED** — preferably represented as a status/flag derived from dependencies rather than as a completely separate lifecycle.
- **CANCELLED** — project is intentionally abandoned.

### Important semantic distinction

**Backlog** means:

> Things we might do.

**Activated** means:

> Things we have committed to doing.

**Scheduled** means:

> Things we have committed to doing at a particular time.

Activation should therefore be a deliberate commitment, not merely another way of saying "open."

---

# 3. MVP Scope

## In scope

- Create/edit/delete household projects.
- Manually prioritize backlog.
- Project effort estimate: S / M / L.
- Estimated cost.
- Project description/notes.
- Assignee.
- Vendor directory.
- Link one or more vendors to a project.
- Project dependencies.
- Identify blocked projects.
- Activate projects.
- Schedule activated projects.
- Dashboard of activated/scheduled/in-progress projects.
- Mark projects complete.
- Basic project history.
- **An annual budget, and a committed / spent / remaining line computed from estimated costs** (added 2026-09-13).
- **The monthly vendor list** — active projects grouped by vendor, copyable as text (added 2026-09-13).

*Reviewed 2026-09-13:* the items below are **in scope but deferred**, in this order, each gated on evidence from real use (see the backlog stories):

- Scheduling and the day/week dashboard (D3).
- Project dependencies and the derived blocked state (D4).
- One-way App -> Google Calendar integration with the event ID stored per project (D5).

## Explicitly out of scope for MVP

Do NOT build:

- General household chores/to-do management.
- Recurring tasks.
- Automatic priority scoring.
- AI-generated project plans.
- Automatic vendor discovery.
- Two-way Google Calendar synchronization.
- Multi-user authentication/permissions.
- Push notifications.
- Complex workflow automation.
- Sophisticated reporting/analytics.
- Marketplace/payment functionality.

Design the data model so these could be added later without major restructuring.

---

# 4. Project Data Model

A Project should contain approximately:

```text
Project
---------
id
title
description
priority
effort
estimated_cost
status
assignee_id (nullable)
vendor_ids[]
dependency_ids[]
scheduled_start (nullable)
scheduled_duration_minutes (nullable)
calendar_event_id (nullable)
created_at
updated_at
completed_at (nullable)
```

*Reviewed 2026-09-13:* one more record, held in the same document:

```text
Budget
---------
year
amount
currency: USD
```

Committed (estimated cost of every activated / scheduled / in-progress project), spent (estimated cost of every project completed in `year`) and remaining are **computed, never stored**. A project with no estimated cost counts as zero and is counted so the UI can say "3 projects without a cost yet".

## Priority

For MVP, priority is **manual ordering**.

Do not attempt to calculate priority automatically.

The backlog should support drag/reorder or another very simple mechanism for changing order.

The ordering should be persistent.

Possible implementation:

```text
priority_order: integer
```

Lower number = higher priority.

Do not use "High / Medium / Low" as the primary ordering mechanism unless needed for UI display. The actual backlog order is more useful.

---

# 5. Effort Estimation

Use three effort categories:

| Size | Meaning |
|---|---|
| S | Less than ~4 hours of active work |
| M | ~4–16 hours of active work |
| L | More than ~16 hours of active work |

Important:

**Effort means active work, not elapsed calendar time.**

For example:

- Waiting for paint to dry does not count as effort.
- Waiting three days for a vendor does not make a project L.
- A project requiring 12 hours of actual work is M even if it spans several calendar days.

The UI can simply show S / M / L.

The data model should use an enum:

```text
S
M
L
```

Do not initially require exact hour estimates.

---

# 6. Cost Estimation

MVP should support an estimated cost.

Recommended representation:

```text
estimated_cost: decimal
currency: USD
```

Allow the user to enter an approximate dollar amount.

Do not require exact accounting.

Design the model so a future version can add:

```text
actual_cost
```

without changing the core project structure.

## Annual budget (added 2026-09-13)

The household has one home-improvement budget per year, tracked monthly in spending outside this app. The app holds the figure and shows, at the top of every screen that lists projects:

```text
2026 budget  $12,000   committed $4,350   spent $2,100   remaining $5,550
```

This line is the reason the app exists: it answers "where are we against the year" without a spreadsheet. `actual_cost`, when it comes, replaces estimated cost in *spent* and nothing else changes.

---

# 7. Assignee

Every project should optionally have an assignee.

Examples:

- Me
- Partner
- Child
- Household
- Vendor

For MVP, this can simply be a free-text or predefined local-person field.

Do not build user accounts or permissions.

Reason:

A household project is not necessarily performed by a vendor. The app needs to distinguish:

```text
Project -> Me
Project -> Partner
Project -> Household
Project -> Vendor
```

---

# 8. Vendor Directory

Vendors are reusable entities rather than fields copied onto projects.

## Vendor

```text
Vendor
---------
id
name
category
phone
email
website
notes
created_at
updated_at
```

A project can have zero, one, or multiple vendors.

Example:

```text
Bathroom remodel
  ├── Plumber
  ├── Electrician
  └── Contractor
```

The same vendor should be reusable across multiple projects.

A project should also be able to have **no vendor**, representing DIY work.

---

# 9. Dependencies

*Reviewed 2026-09-13:* **deferred to story D4.** Built only if the migration (DE2) records a project that waited on another and nobody noticed. The design below stands as written for when that day comes.

Projects can depend on other projects.

Example:

```text
Paint bedroom
    depends on
Repair drywall
```

For MVP, implement **hard dependencies only**.

A hard dependency means:

> The dependent project should not be considered ready until the prerequisite project is completed.

Data model:

```text
ProjectDependency
-----------------
project_id
depends_on_project_id
```

Prevent:

- A project depending on itself.
- Circular dependency chains where practical.
- Duplicate dependency relationships.

## Blocked state

A project should be considered blocked if it has an incomplete dependency.

Example UI:

```text
Paint bedroom

🔒 Blocked by:
Repair drywall
```

Prefer deriving `blocked` from dependencies rather than storing an independent boolean that can become stale.

---

# 10. Activation

Activation is one of the most important concepts in the app.

A backlog project can be activated.

Activation means:

> The household has decided this project is now a committed project.

Activation should be a deliberate user action.

Possible UI:

```text
[ Activate Project ]
```

After activation:

- project leaves the purely passive backlog view
- project appears in the Active/Projects dashboard
- user is prompted or enabled to schedule it
- project can be added to Google Calendar

Activation does not necessarily mean work starts immediately.

---

# 11. Scheduling

Activated projects can be scheduled.

Scheduling should contain:

```text
scheduled_start
scheduled_duration_minutes
```

Do not equate S/M/L directly with calendar duration.

For example:

```text
Effort: M
Scheduled duration: 3 hours
```

is perfectly valid.

Effort describes total active work.

Scheduling describes a particular calendar commitment.

## Scheduling constraints

Do not build a complex scheduling engine in MVP.

Simply allow:

- date
- start time
- expected calendar duration

Future versions can add:

- deadlines
- date windows
- recurring scheduling
- availability constraints
- vendor availability
- multiple work sessions

---

# 12. Google Calendar Integration

*Reviewed 2026-09-13:* **deferred to story D5**, the app's first and only egress door. It waits for a month of D3 in use with dates still copied to the calendar by hand, and for a spike answering whether Google OAuth (PKCE) from a public GitHub Pages origin with the token in the device's storage is acceptable. The registry row's *Egress doors* cell changes before any code. The design below stands as written.

MVP should support **one-way synchronization**:

```text
App
 |
 | create/update/delete
 v
Google Calendar
```

Google Calendar is the scheduling authority once an event has been created.

Do NOT implement full bidirectional synchronization in MVP.

## Required behavior

When a project is scheduled and the user chooses to add it to Google Calendar:

1. Authenticate/connect Google Calendar.
2. Create a calendar event.
3. Store the resulting Google Calendar event ID on the project.
4. Mark the project as calendar-linked.

Example:

```text
calendar_event_id = "abc123..."
```

This ID is important.

If the user later changes the project's scheduled time in the app, update the existing calendar event rather than creating a duplicate.

If the user removes calendar integration for a project, delete the corresponding event where possible.

## Calendar event

Suggested event:

```text
Title:
[Household] Paint bedroom

Description:
Project details...
Effort: M
Estimated cost: $250
Vendor: ...
```

Do not over-engineer the event contents.

---

# 13. Dashboard

The dashboard is the primary operational screen.

It should show all **activated projects**, especially scheduled and currently active projects.

*Reviewed 2026-09-13:* the budget line sits above everything (§6), and until scheduling exists (D3) the Active screen has two sections — **This month, by vendor** (the list N. hands to vendors; one tap copies it as text) and the rest. The day/week sections below arrive with D3.

Suggested sections:

```text
ACTIVE PROJECTS

Today
------
Paint bedroom
10:00–12:00
Me

This Week
---------
Fix fence
Saturday 9:00
Vendor: ABC Fencing

Unscheduled
-----------
Replace faucet
Blocked: Buy faucet

Upcoming
--------
...
```

The exact visual design is flexible, but the dashboard should answer immediately:

1. What household projects are active?
2. What is happening today?
3. What is coming up?
4. What is unscheduled?
5. What is blocked?

The dashboard should not become a generic task list.

---

# 14. Backlog

The backlog should be intentionally simple.

Primary view:

```text
HOUSEHOLD PROJECTS

1. Fix garage door
   M · $500

2. Paint bedroom
   S · $150

3. Replace faucet
   S · $200

4. Organize garage
   L · $0
```

Actions:

- Add project
- Edit project
- Reorder project
- Activate project
- Delete/archive project

The ordering itself represents priority.

---

# 15. Project Detail

Project detail should expose all important information without requiring excessive navigation.

Suggested structure:

```text
Paint Bedroom

Status
Scheduled

Effort
M

Estimated cost
$250

Assignee
Me

Vendor
ABC Painting

Dependencies
None

Scheduled
Saturday, Sept 19
10:00–13:00

Notes
...
```

Primary actions should depend on state.

Backlog:

```text
[ Activate ]
[ Edit ]
```

Activated:

```text
[ Schedule ]
[ Edit ]
```

Scheduled:

```text
[ Start ]
[ Reschedule ]
[ Open Calendar Event ]
[ Complete ]
```

In progress:

```text
[ Complete ]
[ Edit ]
```

---

# 16. Completion

When a project is completed:

- Set status = COMPLETED.
- Set completed_at.
- Remove it from the active dashboard.
- Keep it in project history.
- Do not automatically delete its calendar event unless explicitly desired.

The app should preserve completed projects for future reference.

Future versions can use this history for:

- spending analysis
- project duration analysis
- vendor performance
- household maintenance history

---

# 17. Navigation

Keep navigation minimal.

Recommended MVP:

```text
Bottom navigation

[ Backlog ]   [ Active ]   [ Completed ]        ← D1
[ Backlog ]   [ Active ]   [ Vendors ]   [ Completed ]   ← from D2
```

*Reviewed 2026-09-13:* Completed is a tab from the start — the history is part of the budget line's *spent*.

Optional:

```text
[ Completed ]
```

or include completed projects through the Active/project history interface.

Avoid a large settings/navigation hierarchy.

---

# 18. Add Project Flow

Adding a project should be extremely fast.

Minimum required input:

```text
Project name
```

Everything else should be optional.

Suggested flow:

```text
+ Add Project

What needs to get done?
[ Fix leaking faucet        ]

Effort
[ S ] [ M ] [ L ]

Estimated cost
[ $                 ]

Assignee
[ Me                 ]

Vendor
[ None / Select vendor ]

Dependencies
[ None / Select projects ]

Notes
[ ... ]

[ Add to Backlog ]
```

Do not force users to complete every field before creating a project.

A project can start as:

```text
"Fix leaking faucet"
```

and be refined later.

---

# 19. UX Principles

## Low friction

Creating a project should take seconds.

## Commitment over administration

The app should make activation feel meaningful.

## Visibility over complexity

The user should be able to see what matters without opening multiple screens.

## Manual judgment over fake precision

Do not pretend the app knows household priorities better than the household.

## Progressive detail

Allow projects to start simple and become more detailed when they are activated.

This is especially important.

A useful conceptual flow is:

```text
Capture
   ↓
Prioritize
   ↓
Activate
   ↓
Refine
   ↓
Schedule
   ↓
Execute
   ↓
Complete
```

Not every backlog item needs a vendor, cost, dependencies, or schedule.

---

# 20. Suggested Technical Architecture

*Reviewed 2026-09-13 — decided:* Domus is built in the **Kairos Floor pattern**, like the Whiteboard: one `index.html` with no build step and no dependencies, state as one JSON document in `localStorage` under `domus:v1`, a network-first service worker with a cache name bumped on every content change, hosted on GitHub Pages from a public repo (`nklassen-app/kairos-domus`), wrapped in a Capacitor shell whose `server.url` points at Pages, debug APK sideloaded. Scaffolded by `kairos-foundation/scripts/new-module.sh phone kairos-domus` after its registry row exists. The layers below still apply as a discipline inside the one file (a `state` object and pure functions over it, a render step, storage last); the "local database" is the document and "external integrations" is empty until D5. The stack text that follows is the original and is kept for the record.

The coding agent should choose an appropriate modern mobile stack, but favor:

- Mobile-first.
- Local-first data storage.
- Simple relational data model.
- Offline-capable core experience.
- Google OAuth for Calendar.
- Secure storage for authentication tokens.
- Clear separation between domain logic and UI.

Suggested conceptual layers:

```text
UI
 |
Domain / Application Logic
 |
Repository / Data Access
 |
Local Database
 |
External Integrations
      |
      └── Google Calendar
```

Do not make Google Calendar a prerequisite for using the app.

The app should be fully usable without calendar integration.

---

# 21. Data Relationships

Conceptual model:

```text
HOUSEHOLD
   |
   +-- PROJECTS
   |     |
   |     +-- ASSIGNEE
   |     |
   |     +-- VENDORS
   |     |
   |     +-- DEPENDENCIES
   |     |
   |     +-- CALENDAR EVENT
   |
   +-- VENDORS
```

More specifically:

```text
Project
  ├── belongs to zero/one Assignee
  ├── has zero/many Vendors
  ├── depends on zero/many Projects
  └── has zero/one Calendar Event
```

---

# 22. Important Business Rules

Implement these rules explicitly.

### Rule 1 — Backlog projects are not commitments

A backlog project does not appear as an active commitment.

### Rule 2 — Activation creates commitment

Activated projects appear on the active dashboard.

### Rule 3 — Scheduling is separate from activation

A project can be activated without immediately having a calendar time.

### Rule 4 — Blocked projects remain visible

A blocked project should not disappear from the dashboard.

It should clearly indicate why it is blocked.

### Rule 5 — Effort ≠ calendar duration

S/M/L represents active work, not elapsed time or calendar booking duration.

### Rule 6 — Manual backlog ordering is the priority system

Do not automatically calculate priority.

### Rule 7 — Calendar integration is optional

The app remains useful without Google Calendar.

### Rule 8 — Calendar event IDs must be persisted

Never create duplicate events when rescheduling.

### Rule 9 — Completed projects remain stored

Completion removes a project from active work, not from history.

### Rule 10 — The budget line is always computed (added 2026-09-13)

Committed, spent and remaining are derived from estimated costs and the stored budget figure on every render. Nothing caches them; nothing lets them drift from the projects.

### Rule 11 — Nothing is scheduled outside the app (added 2026-09-13)

This is a rule for the household, not the code: vendor work is scheduled only from what the app holds. Two monthly cycles with the vendor list still written by hand kill the app.

---

# 23. MVP Acceptance Criteria

The MVP is successful if a user can complete this workflow:

### Scenario

"I realize that I need to fix a leaking faucet."

1. Open app.
2. Create "Fix leaking faucet."
3. Project appears at bottom of backlog.
4. Move it higher in priority.
5. Set effort = S.
6. Set estimated cost = $100.
7. Select a vendor.
8. Activate project.
9. Project appears in Active dashboard.
10. Schedule it for Saturday at 10 AM for 2 hours.
11. Add it to Google Calendar.
12. Calendar event is created.
13. Project dashboard shows it as scheduled.
14. Start the project.
15. Mark it complete.
16. Project disappears from Active dashboard.
17. Project remains available in completed history.

### Budget scenario (added 2026-09-13)

1. Set the 2026 budget to $12,000.
2. Backlog holds "Fix garage door" $500, "Paint bedroom" $150, "Organize garage" with no cost.
3. Activate "Fix garage door": committed shows $500, remaining $11,500, "1 project without a cost".
4. Complete it: spent $500, committed $0, remaining $11,500.
5. Reopen the app: the same numbers.

### Monthly list scenario (added 2026-09-13)

1. Two active projects linked to "ABC Fencing", one to nobody.
2. The Active screen's "This month" groups them: ABC Fencing (2), DIY (1).
3. Copy as text gives one heading per vendor and one line per project with effort and cost.

*Reviewed 2026-09-13:* in the first scenario above, steps 10–13 (scheduling, the calendar event) belong to D3 and D5 and are not part of the first definition of done. The two scenarios below belong to D4 and D5.

### Dependency scenario

"Paint bedroom" depends on "Repair drywall."

1. Create both projects.
2. Set Paint bedroom dependency = Repair drywall.
3. Repair drywall remains incomplete.
4. Paint bedroom displays as blocked.
5. Complete Repair drywall.
6. Paint bedroom automatically becomes unblocked.

### Rescheduling scenario

1. Schedule project.
2. Create Google Calendar event.
3. Change scheduled time in app.
4. Existing Google Calendar event is updated.
5. No duplicate event is created.

---

# 24. Things Deliberately Deferred

Do not allow future-feature thinking to complicate the MVP.

Potential future features include:

### Intelligent prioritization
Use project attributes and household goals to suggest backlog order.

### AI project decomposition
Turn:

> "Redo bathroom"

into:

- measure bathroom
- research fixtures
- get quotes
- select contractor
- order materials
- schedule work

### Recurring maintenance
Turn completed projects into maintenance schedules.

### Cost tracking
Compare estimated vs. actual spending.

### Vendor intelligence
Track:

- projects completed
- total spending
- ratings
- reliability
- categories

### Household collaboration
Shared accounts and responsibilities.

### Calendar intelligence
Two-way synchronization and conflict detection.

### Analytics

Examples:

> "We completed 23 projects this year."

> "Our average project takes 1.7 weeks from activation to completion."

> "We've spent $8,400 on home projects this year."

These are potentially valuable, but none should complicate the initial implementation.

---

# 25. Design Direction

The app should feel more like a **calm household project command center** than a productivity app.

Prioritize:

- Clear typography.
- Strong hierarchy.
- Minimal decoration.
- Fast interactions.
- Obvious status.
- Clear distinction between backlog and commitments.
- Visual indication of blocked projects.
- Very low cognitive load.

The most important screen should probably be the **Active dashboard**, not settings or project configuration.

The most important interaction should probably be:

```text
Backlog → Activate → Schedule
```

---

# 26. Implementation Strategy for a Vibecoding Agent

*Reviewed 2026-09-13:* the six slices this section held are **replaced by the stories** in `kairos-system/BACKLOG.md`, epic *The household projects backlog*. Each story leads with a definition of done written as functionality and a radius small enough to try on the phone in one session. In order:

| Story | What it is | The old slice |
|---|---|---|
| DE1 | On the road: registry row, scaffold, this spec into `docs/` | — |
| D1 | The backlog with a budget line: add, effort, cost, manual order, activate, complete, the year's line, three tabs | 1 + 2, plus the budget |
| DE3 | The phone: public repo, Pages, the Capacitor shell, first APK | — |
| D2 | Vendors, and the monthly list that replaces the hand-written document | 3 (vendors half) |
| DE2 | The migration, and two monthly cycles — the epic's verdict lives here | — |
| D3 | Scheduling and the day/week dashboard | 4 |
| D4 | Dependencies and the derived blocked state — only on evidence | 3 (dependencies half) |
| D5 | One-way Google Calendar — only after a spike | 5 |

Polish (the old slice 6) is not a story: empty states, confirmations and edge cases are part of each story's definition of done for the screens it touches.

---

# 27. Agent Instructions

The coding agent should follow these principles:

1. **Build the smallest working version first.**
2. Do not add features that are not in this specification without explicitly identifying them as a proposed change.
3. Keep the core data model relational and extensible.
4. Keep the app functional without Google Calendar.
5. Prefer local-first behavior.
6. Avoid premature abstraction.
7. Test the complete project lifecycle end-to-end.
8. Treat activation as a first-class domain concept.
9. Treat backlog ordering as the priority mechanism.
10. Keep effort and scheduling duration separate.
11. Derive blocked status from dependencies.
12. Persist Google Calendar event IDs to prevent duplicate events.
13. Make project creation fast and optional-field friendly.
14. Do not turn this into a generic task-management application.

---

# 28. Definition of Done

The MVP is done when a user can:

> **Capture a household project → prioritize it → activate it → assign ownership/vendor → resolve dependencies → schedule it → put it on Google Calendar → execute it → complete it → retain it in history.**

The application should make this workflow feel substantially easier than keeping household projects in a generic notes app, spreadsheet, or to-do list.
