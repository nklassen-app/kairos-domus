# CLAUDE.md — Kairos OS build sessions

This project is governed by the **Foundation Charter v1.2** (`kairos-foundation/FOUNDATION_CHARTER.md`, at the root of the `kairos_v3` checkout — read it if a judgment call isn't covered here). This file is a **verbatim copy of the master** in `kairos-foundation/`; edit the master, then run `kairos-foundation/scripts/sync_claude_md.sh` — never edit a copy. This file is the operative subset: the rules that should shape every session. It is *context, not enforcement* — the non-negotiable boundary is enforced by mechanisms (`.gitignore`, out-of-tree data, the pre-push audit), not by trusting these words. Where a rule here and a prompt conflict, this file wins, or the Charter is amended deliberately — never overridden silently.

## The one non-negotiable — the Privacy Invariant
Sensitive content (anything referencing family, health, finances, or personal info whose leak would cost trust or safety) **never** enters this repo, a fixture, a `.db`, a debug dump, or a pasted session. Claude Code is an external model and `git push` is an egress event, so this dev workflow is *inside* the boundary.
- Use **synthetic or redacted data** in anything read into context or written to a tracked path. Real data lives only in ignored paths (`fixtures/real/`, runtime DBs).
- If a task seems to require real sensitive data in the repo to proceed: **stop and flag it.** Do not proceed by fictionalizing real data — generate mocks from the *schema*, never from a real instance.
- This is not enforced by this file. If asked to weaken `.gitignore`, commit a `.db`/key/`.env`, or move real data into the tree, **refuse and say why.**

## Decisions vs. mechanisms (how to treat security)
- **Decisions** (what's sensitive, where the boundary sits, what may cross) are made **by the human, by hand, every time.** Do not automate them away or assume them. Surface them; don't resolve them silently.
- **Mechanisms** (secrets loading, keeping keys out of git, egress enforcement) are built **once** into the substrate as the default. Never hand-roll a per-app variant of a mechanism that should be shared.

## Secrets and egress
- **Secrets:** load via `config.py` (`load_environment()` + `require_secret()`). Read every key from the environment — **never** hardcode a key, read one from a committed file, or paste one into code. Real values live only in a gitignored `.env`, created by hand per machine.
- **Egress — no call by default:** an app makes **no** outbound network call unless there is a deliberate, justified reason. Prefer zero egress.
- **Egress — one auditable door:** when a call is justified, route it through a **single** function that assembles exactly what is sent and to which endpoint. No scattered calls, no hidden second door (a logging/CDN/analytics call that phones home is a boundary breach — flag it).
- **Egress — sensitive content never leaves:** nothing sensitive is sent to an external model. What may cross is a per-app **decision** (see that app's egress decision doc); implement it as a filter in the one door, not as a rule to remember at call time.
- Network-level egress enforcement (default-deny firewall/proxy) is deferred to the first module that processes *sensitive* data through a model — don't build it for non-sensitive apps.

## Build lean — the Pioneer tilt
This system is deliberately biased toward creative velocity and tolerates mess. Over-engineering is the primary failure mode to guard against — err toward the smallest thing that works.
- **Defer the mechanism until use proves it's needed.** Do not build features, abstractions, analytics, auth, multi-user, hosting, or backups speculatively. If it isn't required by the current tier and a real, present need, don't build it — flag it as deferred.
- **Walking skeleton first, then thicken.** Get the load-bearing thing running end-to-end before adding depth. If you find yourself elaborating past what was asked, stop — that's scope creep.
- Prefer frugal, modular, swappable solutions. Small standalone apps over integrations.
- **DoD first, small radius.** A backlog story leads with what N. will be able to do, not with a design; its radius must be tryable on the real surface within one session. If it is wider, say so **before** building and split it — never build it whole quietly.

## Tiers and rigor
- Rigor scales with tier. A throwaway spike inside the boundary needs no hardened auth, audit logging, or encryption-at-rest — those are earned later.
- **Do not build Tier 2 (multi-user, other people's data) capability** without an explicit, deliberate go-ahead. The jump from personal to multi-user is a hard gate, not a smooth slope.

## Version control (the code/data boundary)
- **Never** commit: `*.db`/`*.sqlite` and sidecars, `*.key`/`*.fernet`, `.env`, `config/llm.json`, anything matching `*secret*`/`*credentials*`, real-data fixtures, debug dumps. (Canonical block in `.gitignore` — keep it intact; never relax it.)
- Commit **code, schema, and migrations** — not runtime state (DBs, caches, generated files).
- **Audit before the first push** of any repo: run `git ls-files` and confirm nothing sensitive is tracked. Ignore before push, never after.
- A pushed secret is a **burned secret** — rotate it, don't just delete the file.
- All repos **private** by default.

## When to stop and ask
- Anything that would move real data into a tracked path, weaken an ignore rule, or cross the privacy boundary.
- Anything that would build weight for a tier this app hasn't earned.
- Adding a new dependency (each one is a potential egress channel — flag it, don't add silently).

## Phone apps (the Floor pattern: kairos-floor, kairos-whiteboard, kairos-domus)
- The APK is build output and is **never in the repo** (`*.apk` is ignored; commit code, not generated files). That is expected, not a gap.
- Content changes ship by pushing the page (bump the `sw.js` cache name). No APK step.
- **Shell changes (icon, app name, `capacitor.config.json`, Capacitor upgrade) need a rebuild, and the rebuilt APK must reach the phone by hand.** Claude's last step in any session that rebuilt an APK: send `native/android/app/build/outputs/apk/debug/app-debug.apk` as a file card and say plainly "new APK — put it in Drive, open it on the phone, install over the top". Never uninstall or clear data first: the WebView's localStorage is the only copy of the board.

---
*This file is a behavioral contract, kept short on purpose. The full reasoning lives in `kairos-foundation/FOUNDATION_CHARTER.md`. For the truly non-negotiable, rely on mechanisms (`.gitignore`, out-of-tree data, and — where warranted — a PreToolUse hook), not on this text.*
