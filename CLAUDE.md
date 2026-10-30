# CLAUDE.md — Kairos build sessions

The operative rules for every Kairos session, under the **Foundation Charter** (`kairos-foundation/FOUNDATION_CHARTER.md` in the `kairos_v3` checkout: read it when a judgment call isn't covered here; it holds the reasons and the history). This file is a **verbatim copy of the master** in `kairos-foundation/`: edit the master, run `kairos-foundation/scripts/sync_claude_md.sh`, never edit a copy. It is context, not enforcement: the boundary is held by mechanisms (`.gitignore`, out-of-tree data, the pre-push audit, permission rules). Where a prompt conflicts with this file, this file wins, or the Charter is amended deliberately, never silently.

## 1 · The boundary — the Privacy Invariant (non-negotiable)
Sensitive content (family, health, finances, personal info whose leak would cost trust or safety) **never** enters a repo, a fixture, a `.db`, a debug dump or a pasted session. Claude Code is an external model and `git push` is an egress event, so this workflow is *inside* the boundary.
- **This session is the Consumer tier:** Public, Personal (by hand) and synthetic data only. Anything read into context or written to a tracked path is synthetic or redacted; real data lives only in ignored paths (`fixtures/real/`, runtime DBs). Mocks come from the *schema*, never from a real instance.
- **Classes:** Public · Personal (mundane: chores, estimated costs, workouts) · Held (already at a provider: mail, calendar, contacts; personal-strategy content) · Crown jewels (family, health, detailed finances, the partner's data, how to reach the house). **Tiers:** Home (N.'s devices) · Rented (started, used, destroyed; tailnet only) · Frontier (frontier model, business terms, N.'s account) · Consumer (claude.ai, Claude Code). When unsure, the higher class.
- **Where each class may go** (the full matrix is Charter Part 1): Public and Personal anywhere (Consumer by hand only). Held: Home, Rented, and Frontier through the one door with fields minimised once N. has checked the provider's terms — **never Consumer**. Crown jewels: **Home only** (Rented once a destroyed machine is shown to keep nothing) — **never Frontier or Consumer**. Escape hatch: a logged per-item send of Held to Frontier, decided by N.; none for Crown jewels.
- **Gmail and Google Calendar connectors are denied in Kairos sessions** (`"deny": ["mcp__Gmail", "mcp__Google_Calendar"]` in `.claude/settings.json`). Never call them, never loosen the rule; if it is missing, flag it. (N.'s own use of them outside Kairos is N.'s call.)
- If a task seems to need real sensitive data in the repo, **stop and flag it**; never fictionalise real data to proceed. If asked to weaken `.gitignore`, commit a `.db`/key/`.env`, or move real data into the tree, **refuse and say why.**

## 2 · Security — decisions by hand, mechanisms once
- **Decisions** (what is sensitive, where the boundary sits, what may cross) are N.'s, by hand, every time. Surface them; never automate them away or resolve them silently.
- **Mechanisms** (secrets loading, keys out of git, egress enforcement) are built once into the foundation. Never hand-roll a per-app variant.
- **Secrets:** read every key from the environment via `config.py` (`load_environment()` + `require_secret()`). Never hardcode one, read one from a committed file, or paste one into code; real values live only in a gitignored `.env`, made by hand per machine.
- **Egress:** no outbound call without a deliberate, justified reason. A justified call goes through **one** function that assembles exactly what is sent and where; a scattered call or a hidden second door (logging, CDN, analytics) is a breach — flag it.
- **Model calls** all go through `send_to_model(payload, data_class, tier)` in the foundation, which refuses what the matrix forbids; what an app may send is its egress decision doc's call, built as a filter in that door. Until the door exists, no app sends Held or Crown-jewel content to any model.
- Network-level egress enforcement (default-deny firewall or proxy) waits for the first module that puts Crown-jewel data through a model; don't build it for anything less.

## 3 · How we build — the Pioneer tilt
Over-engineering is the failure mode to guard against: err toward the smallest thing that works.
- **Defer the mechanism until use proves it's needed.** No speculative features, abstractions, analytics, auth, multi-user, hosting or backups; flag them as deferred. Rigor scales with tier: a spike needs no hardened auth, audit logging or encryption at rest.
- **The hard gate:** never build Tier 2 capability (multi-user, other people's data) without N.'s explicit go-ahead.
- **Walking skeleton first, then thicken.** Elaborating past what was asked is scope creep: stop.
- **Use case first, front end last, thin and fragmented.** No shared Kairos surface: Claude Code is where N. builds and steers. A module gets the smallest front end its use needs; an unused one is retired, not polished. Frugal, modular, swappable: small standalone apps over integrations.
- **DoD first, small radius.** A story leads with what N. will be able to do; it must be tryable on the real surface within one session. If it is wider, say so **before** building and split it.
- **Buckets** (the backlog's *Buckets* section): every epic is in **Projects**, **Public profile**, **Foundation** or **Utilities**.
  - **At most three projects in focus in a week**, named on the backlog's focus line and changed only at the weekly review. Build work on a parked project: flag it, don't start; N. decides whether it swaps in.
  - **Utilities** have no epic: each is a story named after its tool. One earns its build by removing a manual step N. has done at least twice; one in flight at a time.
  - **Public profile launches before it gets a process:** no cross-channel routine until ai-era is live with its first three posts.

## 4 · Working with N. — N.'s time goes to quests
N. is the bottleneck; every step that lands on N. has to earn its place.
- **Claude does whatever it can, and N. reviews.** A setting, a command, a draft, a check, a lookup: Claude does it and reports it. N.'s hands only for what Claude cannot reach (an account's own UI, a device, money, a real-world act) and for decisions. A step an agent or a vendor could carry names who, not N.
- **Decisions come prepared**, each with Claude's recommendation. A **taste** decision (naming, design, wording, ordering) carries a **default with a date** that stands if N. doesn't change it. Privacy, the boundary, money and acts in N.'s name never take a default.
- **A step on N. reads as a task:** verb first, what and where, about how long, clear without opening the story ("Read the house-twin page and name the module — 15 min"). It shows only once every step before it in its story is done.
- **A design doc is reviewed in the session that writes it:** Claude puts its open points to N. as a few questions with recommendations and writes the answers back. Only if N. defers does a review become a step on N.

## 5 · The session — start, PRs, end
- **Start: the glance, before touching any file.** Run `kairos-foundation/scripts/kairos_status.sh` on every device, every time. It fetches first; if a repo you're about to touch is "behind", pull or merge first. Its first lines say where the session runs and what that device can't do: pick a story whose steps finish here, or say before starting which step needs another device ("Claude, in a Chromebook session").
- **Start: the dashboard ticks** (issue `nklassen-app/kairos_v3#11`, when `kairos_v3` and the GitHub tools are here). Save the issue body to the scratchpad and run `kairos-foundation/scripts/dashboard.py --apply-ticks <file>`; N.'s ticks become ☑ in the backlog, committed with the session's work.
- **PRs:** opening one is N.'s call. A PR Claude opens is watched until merged or closed: subscribe right away, fix what is asked, answer what isn't, say once when it waits only on N.'s merge, stop when N. says so.
- **End: the dashboard.** After the last backlog change, write the output of `dashboard.py` to the issue body. The issue is never edited by hand, except N.'s ticks.
- **End: one piece of feedback.** Look at how N. worked with Claude this session and give one thing to learn, change or do better: specific, one or two sentences, never praise in its place.

## 6 · Version control — the code/data boundary
- **Never commit:** `*.db`/`*.sqlite` and sidecars, `*.key`/`*.fernet`, `.env`, `config/llm.json`, anything matching `*secret*`/`*credentials*`, real-data fixtures, debug dumps. The canonical block in `.gitignore` stays intact; never relax it. Commit code, schema and migrations, not runtime state or generated files.
- **Audit before the first push** of a repo (`git ls-files`: nothing sensitive tracked; ignore before push, never after) **and before every push**: `kairos-foundation/scripts/audit_push.sh`, the `pre-push` hook, checks the block, refuses the hard net and lists every file sent. N. content-reads that list; a push to a public repo is never sent unread.
- A pushed secret is a **burned secret**: rotate it, don't just delete the file.
- **Repos are private by default.** Public only by the Charter Part 7 exception and where the Registry's Repo column says so: Tier ≤ 1, data only in the viewer's browser, no secret, no outbound call beyond loading its own page. The one named exception is the Whiteboard's `kairosDoor()` (Charter Part 7); a second door is a new amendment. Sensitive or personal-strategy content is never public; making a repo public is N.'s decision.

## 7 · Building a module
No module is named here. What governs one: its **Registry row** (`kairos-foundation/REGISTRY.md`: tier, data class, repo, egress doors, deploy), written before any code; **`kairos-foundation/MODULE_TEMPLATE.md`** for each class's skeleton, conventions and deploy, including the phone-app (Capacitor) pattern; and the module's own README for what is specific to it. Read the template's section for the module's class before changing how it builds or ships.

## When to stop and ask
- Anything that would move real data into a tracked path, weaken an ignore rule or cross the boundary.
- Anything that builds weight for a tier the app hasn't earned.
- A new dependency: each one is a potential egress channel. Flag it; never add one silently.
