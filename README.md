# Domus

The household projects backlog: one prioritized list of home-improvement work
with an estimated cost per project and the year's budget at the top — what is
committed, what is spent, what is left. Projects are activated deliberately,
completed with a date, and kept; the vendors who do the work have a directory. Not a chore app: mundane tasks live on the
Whiteboard and never enter here.

Local-first single page, no build step, no dependencies, no account. Hosted on
GitHub Pages and wrapped in a Capacitor shell for the phone, the same way as
The Floor (`kairos-floor`) and Whiteboard (`kairos-whiteboard`). Scaffolded
from `kairos-foundation/templates/phone-app` on 2026-09-19 (DE1); the design
input is `docs/DOMUS_DESIGN.md`, with the assay's review note at its top. The
stories are in `kairos-system/BACKLOG.md`, epic *The household projects
backlog*.

## The rules

1. A project enters only through the Add field, by title, into the **Backlog**,
   at the bottom. Effort (tap the chip to cycle — · S · M · L) and estimated
   cost (tap to edit) are set on the row, later, or never.
2. The backlog's order **is** the priority. It is set by hand (▲ / ▼) and
   nothing computes it; `priority_order` is renumbered 1..n on every move.
3. A project's moves are Backlog → **Active** (the Activate button — one
   deliberate tap, a commitment) and Active → **Completed** (Done, with the
   date). Completed is newest first, read-only, and never deleted. There is
   no way back from Active to Backlog.
4. Titles are edited in place (tap). Saving empty text keeps the original, so
   editing can never delete. An empty cost *clears* the cost — the project
   then counts as zero and is counted as "without a cost yet".
5. The only delete is hold-a-backlog-row, then confirm. Active projects are
   completed, not deleted.
6. The budget line is always computed from estimated costs, never stored:
   committed = everything active, spent = everything completed in the budget
   year, remaining = budget − committed − spent. The budget figure is set by
   tapping it; the year is the current one.
7. **Vendors** are records of their own (name, category, phone, email,
   website, notes), added by name on the Vendors tab and edited in place:
   tap the name or a field label to edit, tap a phone, email or website to
   use it. Hold a row to delete — a vendor a project still names cannot be
   deleted. Projects name vendors by id; none means DIY (the picker and the
   monthly list are the next story).
8. Nothing is scheduled outside the app (Rule 11 of the spec) — the app is
   the one place vendor work is planned from.
9. State is one JSON document in `localStorage` under `domus:v1`, on one
   device: `{ projects: [...], vendors: [...], budget: { year, amount,
   currency } }`. Every
   project carries the spec's §4 fields from day one, the unused ones empty
   (`vendor_ids`, `dependency_ids`, `scheduled_*`, `calendar_event_id`), so
   later stories add to the record without restructuring it. No backup, no
   sync.

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
