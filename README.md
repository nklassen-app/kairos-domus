# Domus

The household work backlog: everything the household's vendors do, in one
list — small **tasks** (fix a door lock) and **projects** planned by month,
with an estimated cost per project and the year's budget in its own view —
what is planned, what is spent, what is left. Work is completed with a date
and kept; the vendors who do it have a directory. **The line with the
Whiteboard is who does the work** (2026-10-03): work the support team does
belongs here, however small; what N. does alone belongs on the Whiteboard.
A DIY project stays here.

Local-first single page, no build step, no dependencies, no account. Hosted on
GitHub Pages and wrapped in a Capacitor shell for the phone, the same way as
The Floor (`kairos-floor`) and Whiteboard (`kairos-whiteboard`). Scaffolded
from `kairos-foundation/templates/phone-app` on 2026-09-19 (DE1); the design
input is `docs/DOMUS_DESIGN.md`, with the assay's review note at its top. The
stories are in `kairos-system/BACKLOG.md`, epic *The household projects
backlog*.

## The rules

Four places at the bottom: **Plan · Vendors · Budget · Done** (D9b-1).

1. Work enters through the **+** button on Plan: a sheet opens with an
   empty title and **Task · Project** (Project picked); Add saves it (a
   month, vendor, effort and cost can be set first, or later, or never).
   An empty title adds nothing. **A task** (D10) is a title and a vendor
   — no month, effort or cost is asked for. Open tasks sit together in
   **Tasks** at the top of Plan, as slim rows with the vendor's mark, above
   the month groups and never in them; they count in no sum and never in
   the budget. The kind is changed in the sheet, both ways: a project
   turned into a task keeps its month, effort and cost in the record,
   hidden, so turning it back loses nothing. Records from before D10 are
   projects. Everything below said of a project holds for a task unless
   it names a month, effort or cost.
2. **Plan is the one list** of open projects, and the **target month** is the
   priority, not position. It is grouped against today — **this month** (a
   month already past stays here, overdue) · **next month** · **next
   quarter** (the months after next month through the end of the next
   calendar quarter) · **later** (no month, or further out) — so nothing
   needs moving on the first of the month. Empty groups keep their heading,
   greyed. Within a group: earlier month first, then newest last. There is
   no Backlog/Active split and no Activate: a project is open or done.
   Old records keep whatever `status` they had (`backlog`, `activated`);
   every status but `completed` is open. `priority_order` stays in old
   records; nothing reads it.
3. A row is the title, one quiet line (the month where the group does not
   say it · the vendors, or DIY · the effort) and the cost. **Tapping a row
   opens its sheet**, where everything is edited: the title (saving empty
   keeps the original), the month (this month and the eleven after it, or
   later; a past month stays offered while it is the project's), vendors,
   effort (— · S · M · L), estimated cost (empty clears it; a non-number
   leaves it) and notes. Each control saves on its own; Close, a tap
   outside or Escape closes the sheet.
4. **Mark done** in the sheet completes a project with the date; it moves to
   **Done**, grouped by year, newest first, and is never deleted. Marking
   done is reversible: a toast offers **Undo** for a few seconds, and any
   time later a done project's sheet (read-only) offers **Reopen**, which
   puts it back in Plan with the month, vendors, effort and cost it had.
   **Delete** in the sheet removes an open project after a confirm.
5. **Budget** is its own view, always computed, never stored: *planned* =
   open projects with a target month in the budget year (a past month still
   counts); *spent* = projects done in the budget year; *remaining* =
   budget − planned − spent. Missing costs count as zero and are counted.
   Planned is listed by month; open projects with no month ("not planned
   yet") or a month in another year are shown apart and not counted. The
   budget figure is set by tapping it; the year is the current one.
6. **Vendors** are records of their own (name, category, phone, email,
   website, notes), added by name on the Vendors view, listed as a name and
   one quiet line (category · phone) with a mark in the vendor's tint.
   Tapping a vendor opens its sheet: every field edits there (an empty name
   keeps the old one), Call / Email / Website use the details, Delete
   removes it — a vendor a project still names cannot be deleted.
   **Projects name vendors** by id — zero, one or several; none
   means DIY. In a project's sheet, the vendor list adds one (or "+ New
   vendor…", which asks for a name and creates it) and tapping a vendor's
   chip removes it. The "Page · N projects" button in a vendor's sheet opens
   the **vendor page**: open work grouped by month, Done collapsed by year —
   read-only and without the budget, so a screenshot can go to the vendor.
   Open tasks come first on the page, under **Tasks**; done tasks sit in
   Done below the year's projects.
   The costs toggle hides costs and totals for that screenshot; Copy as
   text gives a message to paste to the vendor as it is — a greeting, the
   open jobs numbered (tasks first, without month or cost) with their
   month and notes, a sign-off; costs only
   while shown, done work never. The list can also be **imported** from
   JSON on the Vendors view (a file or pasted text): a bare list, the app's
   own `vendors`, or the household seed's `contacts` — extra fields fold
   into notes, a name already present is skipped. The seed is real contact
   data: it is ignored (`*seed*.json`) and never committed.
7. Nothing is scheduled outside the app (Rule 11 of the spec) — the app is
   the one place vendor work is planned from.
8. State is one JSON document in `localStorage` under `domus:v1`, on one
   device: `{ projects: [...], vendors: [...], budget: { year, amount,
   currency } }`. `kind` is `'task'` or `'project'` (D10; records without
   it gain `'project'` on load). Every project carries the spec's §4 fields from day one,
   the unused ones empty (`dependency_ids`, `scheduled_*`,
   `calendar_event_id`), and `target_month` (`YYYY-MM` or null, D7 —
   records written before it gain it as null on load), so later stories
   add to the record without restructuring it. No backup, no sync.

## Run locally

Serve the folder over HTTP (service workers don't register from `file://`):

```sh
python3 -m http.server 8080          # then open http://<this machine's LAN IP>:8080 on the phone
```

## Test

```sh
cd tests && npm install && npm test  # DOM-level: index.html booted in jsdom under node's test runner
```

## Deploy

Create the **public** repo `nklassen-app/kairos-domus` (Foundation Charter Part 7,
the public-repo rule — content-read before every push), push `main`, enable
GitHub Pages from `main` / root. The page is then at
<https://nklassen-app.github.io/kairos-domus/> and the phone shell points at it.
Bump `CACHE` in `sw.js` (`domus-vN`) **and** the `.ver` marker in
`index.html` with every content change, or the app keeps serving the stale page.

The Android shell lives in `native/`; see `native/README.md`. It only needs
building once, and rebuilding for shell changes (icon, app name, config).
