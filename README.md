# Domus

The household projects backlog: one prioritized list of home-improvement work
with an estimated cost per project and the year's budget at the top — what is
committed, what is spent, what is left. Projects are activated deliberately,
completed with a date, and kept. Not a chore app: mundane tasks live on the
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
   at the bottom. Effort (S · M · L) and estimated cost are added on the row.
2. The backlog's order **is** the priority. It is set by hand (up / down) and
   nothing computes it.
3. A project's moves are Backlog → **Active** (one deliberate tap) and Active →
   **Completed** (with the date). Completed projects are never deleted.
4. The budget line is always computed from estimated costs, never stored:
   committed = everything active, spent = everything completed this year,
   remaining = budget − committed − spent. A project without a cost counts as
   zero and is counted as such.
5. Nothing is scheduled outside the app (Rule 11 of the spec) — the app is
   the one place vendor work is planned from.
6. State is one JSON document in `localStorage` under `domus:v1`, on one
   device. No backup, no sync.

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
