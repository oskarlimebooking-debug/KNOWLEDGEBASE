# Current State

> Last updated: 2026-05-12 (Navigator `/pc-plan` pass #4 — stop running engage on phase-a, drive TA.3+ via `/start-task` instead)

## Active Plan

**Plan:** Headway × ThesisCraft — Full Engage Roadmap (Phases A–Y)
**Status:** Sprint A in progress — TA.1 + TA.2 shipped (2/10); TA.3 unblocked next
**Current Sprint:** A (Foundation) — in_progress
**Active PairCoder plan:** `plan-sprint-0-engage` (in_progress, owns all 10 Sprint-A task files). Note: a vestigial `plan-2026-05-phase-a-foundation` exists with 0 linked tasks — safe to delete in a future cleanup.

## Current Focus

Fresh rebuild from scratch. Per user direction (2026-05-11): ignore any prior implementation state; treat the project as a clean slate. The full 25-phase implementation plan has been mapped to engage-compatible backlog files under `.paircoder/plans/backlogs/`.

## Task Status

### Backlog scaffold (327 tasks across 25 sprints)

| Sprint | File | Tasks | Status |
|---|---|---|---|
| A — Foundation | `phase-a.md` | 10 | Pending — engage next |
| B — AI Core | `phase-b.md` | 12 | Blocked on A |
| C — Mind Map / Socratic / Chat | `phase-c.md` | 8 | Blocked on B |
| D — Feed System | `phase-d.md` | 11 | Blocked on B, C |
| E — TTS + Player | `phase-e.md` | 14 | Blocked on B |
| F — Cloud Sync | `phase-f.md` | 11 | Blocked on A, B |
| G — Architectural Rebuild | `phase-g.md` | 16 | Blocked on A–F (foundational pivot) |
| H — Multi-Project Workspaces | `phase-h.md` | 13 | Blocked on G, F |
| I — Source Generalization | `phase-i.md` | 11 | Blocked on G, H |
| J — Advanced Quizzes | `phase-j.md` | 15 | Blocked on B, C, F |
| K — Multi-Provider AI + Perplexity | `phase-k.md` | 11 | Blocked on B, F |
| L — Discovery Module | `phase-l.md` | 15 | Blocked on G, H, K |
| M — Advanced Import / OCR / URL | `phase-m.md` | 21 | Blocked on A, B, K |
| N — PDF Viewer | `phase-n.md` | 16 | Blocked on A |
| O — Writing Hub | `phase-o.md` | 15 | Blocked on G, H, K |
| P — Writing Exercises | `phase-p.md` | 12 | Blocked on O |
| Q — Citations | `phase-q.md` | 15 | Blocked on I, O, M |
| R — Video & Image Plus | `phase-r.md` | 11 | Blocked on D, K |
| S — Cross-source Intelligence | `phase-s.md` | 12 | Blocked on D, I, B |
| T — Quality of Life | `phase-t.md` | 15 | Blocked on A–F |
| U — Sync Plus | `phase-u.md` | 12 | Blocked on F, G |
| V — Audio Plus | `phase-v.md` | 12 | Blocked on E |
| W — Knowledge Plus + Research Graph | `phase-w.md` | 13 | Blocked on I, Q, B |
| X — Research Mode Suite | `phase-x.md` | 13 | Blocked on Q, W |
| Y — Unlimited Edition | `phase-y.md` | 23 | Pick-and-choose (each task is its own micro-sprint) |

**Total: 327 engage tasks across 95 sub-phases.**

### Critical Path

Default order: `A → B → C → D → E → F → G → H → I → J → K → L → M → N → O → P → Q → R → S → T → U → V → W → X → Y`.

Phase G is the foundational pivot. Sprints H–Y are blocked until G ships.

### Active Sprint

No sprint engaged yet. To start:

```bash
bpsai-pair engage .paircoder/plans/backlogs/phase-a.md --dry-run
bpsai-pair engage .paircoder/plans/backlogs/phase-a.md
```

## What Was Just Done

- **TA.3 done** (auto-updated by hook)

- **TA.3 done (2026-05-12)** — App shell + view system. New `src/ui/` modules: `dom.ts` (typed ShellNode + buildElement), `view.ts` (setView/backView with module-level back stack), `toast.ts` (showToast with per-kind durations + auto-dismiss), `shell.ts` (full app tree as data — header w/ back/title/settings, four view panes, toast container, spinner). `src/app.ts` re-implemented as orchestrator (mountApp + wireHeader). New `src/test/dom-stub.ts` provides a minimal Document/Element mock for tests (no jsdom dep). 72 tests pass; typecheck/build/arch clean. Mobile-first CSS at 320/768/1280 breakpoints; CLS-zero by design (fixed header height, display-toggled panes, no async content insertion). Session entry below.
- **Navigator `/pc-plan` pass #4 (2026-05-12)** — survey-only. Phase A is fully planned; nothing new to plan. Identified engage's circuit-breaker root cause (Phase-1 trap on already-shipped TA.1+TA.2) and the third TA.2 task-file regression. Recommendation: stop running engage on `phase-a.md`; drive TA.3–TA.10 manually via `/start-task`. Session entry below.
- **TA.2 re-finalized after engage-hook regression (2026-05-12)** — `/start-task TA.2` invoked because the engage TA.1 commit (`e78d481`) had a second time reset `TA.2.task.md` back to `status: pending` with all 5 ACs unticked, even though the code shipped many commits ago. Restored the task file (status → done, all 5 ACs ticked), re-ran full verification — 38/38 tests pass, db.ts branch coverage 92.1% (AC ≥ 90%), typecheck clean, arch check clean on all TA.2 source files. No code changes needed; this was pure task-file recovery. Session entry below.
- **Navigator re-plan validation pass #3 (2026-05-12)** — re-ran `/pc-plan phase-a.md`. Plan still healthy (10 tasks / 62 cx / 3 phases, parser clean). Surfaced one regression: `TA.2.task.md` status field reverted from `done` (committed) to `failed` (working tree). Plus the 2026-05-12 audit round 2 work is still uncommitted across 12 files. Session entry below.
- **Phase-A audit round 2 addressed (2026-05-12)** — all 7 findings from the engage-#2 audit closed (38 tests pass). Secrets now in-memory only; innerHTML removed from app shell; CSP and SW tightened; sourcemaps off in prod; paircoder allowlist + Claude deny list hardened. Session entry below.
- **TA.2 finalized (2026-05-11)** — cleared the three pre-existing `tsc --noEmit` errors in `db.test.ts` (IDB stub `this` context + `DOMException` cast), ticked all 5 AC boxes in `TA.2.task.md`, and flipped task status `pending` → `done`. Final verification: typecheck clean, 37/37 tests pass, branches 93.87% (db.ts at 92.1%), arch check clean on all TA.2 source files.
- **Navigator re-plan validation (2026-05-11)** — re-ran `/pc-plan phase-a.md`. Backlog parses cleanly (`engage --dry-run` → 10 tasks / 62 cx / 3 phases). No new planning needed; structure intact. Surfaced 3 housekeeping items below for the next code-touching session to clean up.
- **Phase-A security audit findings addressed** — all 8 audit items closed on `engage/phase-a` branch (37 tests pass).
- **TA.2 done** — IndexedDB schema + wrappers (`ChapterWiseDB` v1, five stores, all wrappers, settings helpers, 27 tests, branches 92%)
- **TA.1 done** — Vite + TS + PWA scaffold

### Session: 2026-05-12 - TA.3 Driver: app shell + view system

After /pc-plan pass #4 recommended driving TA.3 manually, user authorized: "yes do it and start TA.3". Built the full Phase-A shell as five small modules under `src/ui/` plus a minimal test-only DOM stub.

- **`src/ui/dom.ts`** — generic `buildElement(node, doc?)` taking a `ShellNode` tree. Extracted from the prior `app.ts`; added `attrs` support for ARIA/data attributes. Same audit invariant: no `innerHTML` anywhere, strings always go through `createTextNode`.
- **`src/ui/view.ts`** — `setView(root, name)`, `backView(root)`, `getCurrentView()`, `canGoBack()`, `resetViewState()` (test-only). Module-level back stack. Setting the same view twice is a no-op (no double-push). The "no flicker" AC is enforced as an invariant: `setView` removes every prior `view-*` modifier class before adding the new one, so the DOM never has zero matching classes nor two.
- **`src/ui/toast.ts`** — `showToast(container, msg, kind, ms?)` with per-kind durations (info/success 3s, warn 5s, error 6s). Returns `{element, dismiss}`. `aria-live='assertive'` for warn/error, `'polite'` for info/success. Idempotent dismiss.
- **`src/ui/shell.ts`** — `renderAppShell()` returns the full app data tree: header (back/title/settings), four view panes (library/book/chapter/modal-stack), toast container, hidden spinner. Library pane visible at first paint (CLS gate).
- **`src/app.ts`** — re-implemented: `mountApp(root)` builds shell via `buildElement(renderAppShell())`, calls `root.replaceChildren`, and wires header back-button → `backView`, settings → registered handler. `setSettingsHandler(fn)` for late binding.
- **`src/test/dom-stub.ts`** — minimal `StubDocument`/`StubElement` exposing only what the modules touch (createElement/createTextNode/classList sync'd with className/dataset/appendChild/setAttribute/getAttribute/remove/replaceChildren/addEventListener/dispatchEvent/querySelector(.class)). Avoids the happy-dom/jsdom dep entirely.
- **`src/styles.css`** — extended: CSS variables (header height, content max, gaps, accent palette), grid-based app layout, sticky header with fixed `--header-h: 3.5rem`, pane visibility driven by `[data-view]` attr (no display:none transitions → no flicker), toast container at `position: fixed; bottom: 1rem` (never reflows content), spinner at center with `[hidden]`, breakpoints at 768/1280 widening padding + title size + header gutters, `prefers-reduced-motion` kills toast/spinner animations.

CLS-zero design notes (AC #5):
- Header has explicit `height: var(--header-h)` and `grid-template-rows: var(--header-h) 1fr` — reserves vertical space at first paint.
- View panes are pre-rendered; switching toggles `display` based on `[data-view]`. No async content insertion.
- Toast container is `position: fixed` — never shifts other content when toasts appear/dismiss.
- Spinner uses `position: fixed` + explicit dimensions + `[hidden]` → never enters layout flow.
- No web fonts (system font stack) → no FOIT/FOUT.

Verification:
- `npx vitest run` → 72/72 pass (5 app + 7 dom + 8 view + 10 toast + 8 shell + 9 secrets + 25 db).
- `npx tsc --noEmit` → clean.
- `npm run build` → 86ms, 11 modules, 3.72 kB JS + 3.13 kB CSS gzipped.
- `bpsai-pair arch check` → clean on all 11 changed files.
- `npm run dev` → HTTP 200 on `/`, `/src/main.ts`, `/src/ui/shell.ts`.
- `npm run preview` → HTTP 200 on `/`, `/sw.js`, `/manifest.webmanifest`.

ACs:
- ✓ `setView` swaps with no flicker (invariant covered by `view.test.ts` "only one view modifier class at any time")
- ✓ Header back-button handler attached + tested via `dispatchEvent('click')`
- ✓ Toast renders 4 kinds + auto-dismisses (covered by `toast.test.ts`, fake timers)
- ✓ Mobile-first CSS with 768/1280 breakpoints (manual verification via dev server; programmatic viewport test needs a headless browser)
- ✓ CLS-zero by design (no async content insertion, explicit dimensions, fixed positioning for overlays)

Open follow-up:
- Lighthouse CLS measurement: deferred to TA.10 (offline behavior verification) which already requires a browser run.
- UI module coverage: `vite.config.ts` `coverage.include` is `src/data/**/*.ts` only. Consider extending to `src/ui/**/*.ts` in a future sprint cleanup (not in TA.3 scope).

Next coding move: `/start-task TA.4` — Add Book flow (PDF + EPUB) once PDF.js worker self-hosting decision is resolved.

### Session: 2026-05-12 - Navigator `/pc-plan` pass #4 (no input)

User invoked `/pc-plan` with empty input after engage's third circuit-breaker trip suggested "run `/pc-plan` to plan remaining tasks manually". Survey-only Navigator pass — no code changes, no new tasks.

- **Pre-flight clean**: budget no warnings; Trello disabled (designing-and-implementing skill applies).
- **Plans intact**: `plan-sprint-0-engage` owns all 10 Sprint-A task files; backlog parses to 10 tasks / 62 cx / 3 phases. `plan-2026-05-phase-a-foundation` is still a 0-task vestige — defer cleanup.
- **Three sources disagree on TA.2** (third occurrence of the same regression):
  - `TA.2.task.md` committed frontmatter: `status: done`, `completed_at` set, ACs ticked.
  - `TA.2.task.md` working tree: `status: failed` (lifecycle-hook flip during this session, third time).
  - `bpsai-pair task list`: ⏳ pending.
  - Code has been on the branch since `34b9915` (six commits ago).
- **Engage circuit-breaker root cause confirmed**: Phase 1 of `phase-a.md` is `[TA.1, TA.2]`. Both are shipped, so the runner's "meaningful output" check trips every run before it can advance to Phase 2 (TA.3-TA.7). Engage's recovery suggestion (`/pc-plan`) is misleading — the plan is fine; it's the runner that's stuck.
- **Working-tree state on the branch**: `TA.2.task.md` reverted to `failed` (third regression) + `plan-sprint-0-engage.plan.yaml` legitimately flipped `planned → in_progress`. Plus untracked `.paircoder/telemetry/`.
- **Recommendation (Navigator)**: stop running `bpsai-pair engage` on `phase-a.md`. Restore TA.2.task.md to `status: done` in a small bookkeeping commit, then drive **TA.3–TA.10 manually** via per-task `/start-task` invocations. When Sprint A is merged, engage Sprint B fresh on a new branch (`engage/phase-b`) — that escapes the "shipped Phase-1 trap" entirely.
- **Pre-coding decision still standing for Phase A**: PDF.js worker self-hosting for offline (resolve before TA.4 and TA.9).
- **Next coding move**: bookkeeping commit (TA.2 status restore + plan-yaml flip), then `/start-task TA.3` — App shell + view system (P0, cx 5; deps only on TA.1 which is done; ACs: `setView` swaps with no flicker, header back button, toast w/ 4 kinds, responsive at 320/768/1280, no CLS regression).

### Session: 2026-05-12 - TA.2 re-finalize (`/start-task TA.2`)

User invoked `/start-task TA.2` for the second time because the engage run that produced commit `e78d481` ("task(engage): TA.1 — Project skeleton") wrote `TA.2.task.md` back to its pristine pending shape (status: pending, all five ACs unticked). The code itself — `src/data/db.ts`, `src/data/schema.ts`, `src/data/db.test.ts` — has been on the branch since commit `34b9915` and is unchanged. This session was pure task-file recovery + re-verification.

- **What I touched:** only `.paircoder/tasks/TA.2.task.md` (status: pending → done, all 5 ACs re-ticked) and this state.md entry.
- **Verification (no code changed):**
  - `bpsai-pair budget check TA.2` → OK (17,350 tokens, 8.7%, ~$0.05)
  - `npm run typecheck` → clean
  - `npx vitest run --coverage` → 38/38 pass (4 app + 9 secrets + 25 db); db.ts branch 92.1%, schema.ts 100%, secrets.ts 85.71% (Phase-A round-2 secrets module, not TA.2 scope)
  - `bpsai-pair arch check` on `db.ts`, `schema.ts`, `db.test.ts` → all clean
- **CLI flip note:** `bpsai-pair task update TA.2 --status done` was blocked by the dirty tree (state.md + task file edits in flight, plus the still-uncommitted audit-round-2 working tree). Strategy: commit the recovery + audit-round-2 work in the same commit, then the file's frontmatter (already `status: done`) is the authoritative record. If the CLI is needed for completion-hook side effects, run it post-commit on a clean tree.
- **Root-cause hypothesis:** the engage runner's "register task file" path appears to re-emit each task file from the backlog template at the start of every `bpsai-pair engage` run, clobbering manually-edited frontmatter (status) and AC checkboxes. This regression has now hit twice (commits `9ef23e0` and again `e78d481`). Worth filing as a bpsai-pair bug post-Sprint-A: the registration step should diff-and-skip when the local file already has a non-default status.
- **Next coding move:** commit the working tree (this recovery + audit round 2 from 2026-05-12), then `/start-task TA.3`.

### Session: 2026-05-11 - TA.2 finalization (`/start-task TA.2`)

User invoked `/start-task TA.2` to close out the housekeeping flagged in the prior Navigator re-plan pass. Code was already shipped (commits `34b9915` + `f8fee01`) but the task file was stuck at `status: pending`, ACs unchecked, and `db.test.ts` had three lingering typecheck errors. Closed all three loose ends.

- **Typecheck cleanup** — `src/data/db.test.ts:203, 205, 225` (IDB stub `Partial<IDBOpenDBRequest>` + `Error`-not-`DOMException` under `exactOptionalPropertyTypes`). Rewrote both stubs (onerror + onblocked tests) to cast `req` directly to `IDBOpenDBRequest` and invoke handlers via `.call(req, …)` so `this` context lines up. `Error` instance cast to `DOMException` via `unknown` for the `error` field. No behavior change.
- **AC boxes** — ticked all five in `.paircoder/tasks/TA.2.task.md`.
- **Status flip** — `bpsai-pair task update TA.2 --status done` (after committing the working-tree changes that had been blocking the engage-completion guard).
- **Final verification:**
  - `npm run typecheck` → clean (no errors)
  - `npx vitest run --coverage` → 37/37 pass, branches 93.87% overall (db.ts 92.1%, schema.ts 100%, secrets.ts 100%)
  - `bpsai-pair arch check` on `db.ts`, `schema.ts`, `db.test.ts` → clean
- **Next coding move:** `/start-task TA.3` — App shell + view system (P0, Cx 5; depends only on TA.1, unblocked).

### Session: 2026-05-11 - Navigator re-plan validation pass (`/pc-plan phase-a.md`)

User re-invoked `/pc-plan` against the same `phase-a.md` backlog. No new planning was required — the prior plan + 10 task files are intact. Did a validation pass and surfaced three housekeeping items:

- **Backlog re-parses cleanly** — `bpsai-pair engage … --dry-run` → 10 tasks, 62 cx, 3 phases. Phase 1 (TA.1+TA.2) done; Phase 2 (TA.3-TA.7) and Phase 3 (TA.8-TA.10) pending. Matches the existing Sprint A structure.
- **Plan duality discovered (not blocking):** `bpsai-pair plan list` shows TWO plans:
  - `plan-sprint-0-engage` — status `in_progress`, **owns all 10 task files** (each task's frontmatter `plan:` field points here). This is the active plan.
  - `plan-2026-05-phase-a-foundation` — status `planned`, **0 tasks linked**, created during a prior `/pc-plan` run before the tasks were registered against the engage plan. Vestigial.
  - Recommendation: leave plan-sprint-0-engage as the source of truth; optionally archive/delete the 0-task plan-2026-05-phase-a-foundation file in a future cleanup. Not blocking any work.
- **TA.2 status field stale** — frontmatter says `status: failed`, but `completed_at` is set, all 5 ACs are checked, state.md confirms it shipped (27 tests, branches 92%), and the code is on the branch. Likely a leftover from an engage hook returning non-zero after the task itself succeeded. Needs `bpsai-pair task update TA.2 --status done` once the working tree is committable (the engage-completion guard currently blocks task updates because the security-audit changes are uncommitted).
- **Dirty tree blocks CLI updates** — `task update` and other ops bail with "Uncommitted changes detected." The pending changes are exactly the security-audit + setup-config + telemetry/sandbox/secrets work documented in the prior session below. Action: commit, then run the TA.2 status fix.
- **Open decisions still standing:** Pre-A framework choice resolved (Vite+TS, locked by TA.1 ship). Pre-B chapter-ID format resolved (`<bookId>_ch_<index>`, locked by TA.2 docs). PDF.js worker self-hosting decision deferred to TA.4 + TA.9 (still open).
- **Next coding move:** `/start-task TA.3` — App shell + view system (P0, Cx 5, depends only on TA.1 which is done).

### Session: 2026-05-12 - Navigator re-plan validation pass #3 (`/pc-plan phase-a.md`)

User re-invoked `/pc-plan` against `phase-a.md` for the third time. No replanning required — the plan is intact. Validation findings:

- **Plan still healthy** — `bpsai-pair engage … --dry-run` → 10 tasks, 62 cx, 3 phases (Phase 1: TA.1+TA.2; Phase 2: TA.3–TA.7; Phase 3: TA.8–TA.10). All 10 task files exist. `plan-sprint-0-engage` (in_progress) owns all 10.
- **NEW FINDING — TA.2.task.md status regressed in the working tree**: committed value is `status: done` (commit `9ef23e0` "TA.2: mark done — status flip + state.md cleanup"), but the working tree has reverted it to `status: failed`. `bpsai-pair task list` therefore renders TA.2 as ⏳ pending, contradicting state.md and the commit log. Likely caused by an engage-run hook flipping the field during the post-engage-#2 audit cycle. **Fix:** before the next commit, run `git checkout .paircoder/tasks/TA.2.task.md` to drop the spurious revert. If the working tree gets committed in its current shape, follow up with `bpsai-pair task update TA.2 --status done`.
- **Uncommitted working tree (12 files, intended)** — all the 2026-05-12 engage-#2 audit round 2 fixes are sitting uncommitted: `.claude/settings.json`, `.paircoder/security/allowlist.yaml`, `public/sw.js`, `src/app.ts`/`app.test.ts`, `src/data/secrets.ts`/`secrets.test.ts`, `src/test/setup.ts`, `vercel.json`, `vite.config.ts`, plus state.md. Recommended commit message scope: "phase-a audit round 2: secrets in-memory + DOM-safe shell + CSP/SW hardening + allowlist tightening". Drop the TA.2 regression first.
- **Vestigial `plan-2026-05-phase-a-foundation` still present** — 0 tasks linked, status `planned`. Same finding as the prior validation pass. Non-blocking; can be deleted in a future cleanup.
- **Open decisions standing:** Pre-A and Pre-B locked. PDF.js worker self-hosting still deferred to TA.4 + TA.9.
- **Next coding move:** commit the audit round 2 work (with TA.2 revert dropped) → `/start-task TA.3` (App shell + view system, P0, Cx 5, depends only on TA.1).

### Session: 2026-05-12 - Phase-A audit round 2 (post-engage-#2)

Engage-run #2 produced a stricter audit (1 P1 + 6 P2). All addressed in the working tree, ready for engage to commit:

- **P1-1 — sessionStorage XSS-exfil risk**: replaced `src/data/secrets.ts` sessionStorage backing with a module-level `Map<string, string>` plus a `pagehide` listener that clears it. Other origin scripts can no longer reach the store via `sessionStorage.getItem` — the only handle is the module export. Dropped the sessionStorage shim from `src/test/setup.ts`. Rewrote `src/data/secrets.test.ts` with `afterEach` reset; added a defense-in-depth test asserting that `setSecret` does not write into sessionStorage. 9 secret tests pass.
- **P2-1 — `innerHTML` in `src/app.ts:5`**: refactored `mountApp` into three pieces: `renderShell()` returning a typed `ShellNode` data tree (pure data), `buildElement()` materialising it via `createElement` + `createTextNode` (never `innerHTML`/`insertAdjacentHTML`), and `mountApp(root)` which calls `root.replaceChildren(buildElement(renderShell()))`. Updated `src/app.test.ts` to assert shape + a "no HTML-string children" regression guard; tests no longer need a real DOM.
- **P2-2 — `blob:` in CSP `img-src`**: removed from `vercel.json` since no current flow uses blob URLs. Will re-add if/when image uploads land.
- **P2-3 — SW caches by extension, not Content-Type**: `public/sw.js` now runs `isContentTypeValid(url, res)` before `cache.put` — extension `.js`/`.mjs` requires `application/javascript|ecmascript`, `.css` requires `text/css`, font/image/manifest extensions each have their own MIME-prefix gate. A future origin handler that mis-serves `text/html` under a `.js` URL no longer poisons the cache.
- **P2-4 — sourcemap publishing**: `vite.config.ts` `build.sourcemap` flipped from `'hidden'` to `false`. No `.map` files emitted in `dist/`; stack traces will reference minified output. Re-enable to `'hidden'` + Sentry-style upload when an error-aggregator lands.
- **P2-5 — `env`/`printenv`/`python -c` in `always_allowed`**: moved to `require_review` in `.paircoder/security/allowlist.yaml` with an inline rationale citing the audit. The combined risk (env dumps via `env_passthrough: [GITHUB_TOKEN, TRELLO_API_*]`, arbitrary Python via `-c`) is now gated behind a confirmation step rather than silent.
- **P2-6 — `.claude/settings.json` deny-list gaps**: added Read/Edit/Write deny patterns for `**/.ssh/**`, `**/*.pem`, `**/*.pfx`, `**/*.p12`, `**/.aws/credentials`, `**/.aws/config`, `**/.config/gcloud/**`, `**/.kube/config`, `**/kubeconfig`, `**/.docker/config.json`. JSON re-validated.

Verification:
- `npx vitest run` → 38/38 pass (4 app + 9 secrets + 25 db).
- `npx tsc --noEmit` → clean.
- `python3 -m json.tool` → both `.claude/settings.json` and `vercel.json` parse.
- `bpsai-pair arch check` on every touched TS file → clean.

### Session: 2026-05-11 - Phase-A security audit fixes (engage/phase-a branch)

After `bpsai-pair engage` ran Phase 1 of phase-a (TA.1 + TA.2) and tripped the circuit breaker, the post-engage security audit produced 0 P0 / 2 P1 / 8 P2 findings. Addressed:

- **P1-#1 — vercel.json security headers**: added CSP (`default-src 'self'`, strict allowlist incl. `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests`), HSTS (2 years + preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny geolocation/camera/mic/payment/usb/cohort), COOP/CORP `same-origin`. Applied to `/(.*)`; existing SW + manifest header blocks preserved.
- **P1-#2 — secret storage decision + implementation**: chose memory-only model (sessionStorage). Added `src/data/secrets.ts` with `setSecret`/`getSecret`/`clearSecret`/`clearAllSecrets` under reserved prefix `headway:secret:`. TDD: 10 new tests in `src/data/secrets.test.ts` (round-trip, overwrite, falsy empty-string, isolation from non-secret keys, name validation). Updated `src/data/db.test.ts` to remove the misleading `apiKey: 'sk-xxx'` example from the `aiProfile` round-trip test — now uses `{model, temperature}` and carries an inline policy comment pointing at `secrets.ts`. Added a sessionStorage shim to `src/test/setup.ts` for Node test runs.
- **P2-#4 — `docs/.DS_Store`**: `git rm --cached`; already covered by root `.DS_Store` line in `.gitignore` (no new entry needed).
- **P2-#5 — vite sourcemaps**: `vite.config.ts` `build.sourcemap: true` → `'hidden'`. Original sources no longer published; stack traces still resolve when maps are uploaded out-of-band.
- **P2-#6 — service worker cache scope**: `public/sw.js` now caches only the precached shell + hashed static assets (js/mjs/css/woff2/png/jpg/svg/ico/etc.). API/auth path prefixes (`/api/`, `/auth/`, `/oauth/`) and any non-static GET pass through without caching. Navigation responses are no longer added to cache (network-first, fall back to precached `/index.html` offline).
- **P2-#9 — `.paircoder/security/secret-allowlist.yaml`**: rewrote glob-style `test_*`/`****` patterns as anchored regex with bounded length (e.g. `^test_[a-z0-9_-]{1,32}$`) so real keys named e.g. `test_prod_aws_key` are no longer masked. Vendor test prefixes (`sk_test_*`, `pk_test_*`) also anchored.
- **P2-#10 — `.paircoder/security/sandbox.yaml`**: bare `curl`/`wget` removed from `network_allowed_commands`. Git/pip/npm entries narrowed to specific subcommands/remotes (`git fetch origin`, `pip install --index-url https://pypi.org/simple/`, `npm install --registry=https://registry.npmjs.org/`). Inline comment documents the no-bare-verbs rule.

Verification:
- `npx vitest run` → 37/37 pass (10 new + 27 existing).
- `npx tsc --noEmit` → only pre-existing TA.2 errors in `db.test.ts:203/205/225` (IDB stub types under `exactOptionalPropertyTypes`); not introduced by audit work.
- `bpsai-pair arch check` on all new files → clean.

- **P2-#3 — dead `SessionStart` hook**: `.claude/settings.json` was invoking `bash scripts/bootstrap-remote.sh` against a non-existent `scripts/` directory (silent failure every session, foothold for any future drop at that path). User authorized removal; entire `"SessionStart"` block deleted, JSON re-validated.

Open / follow-up:
- **TA.2 typecheck cleanup**: three pre-existing `tsc --noEmit` errors in `db.test.ts` IDB-onerror/onblocked stubs under `exactOptionalPropertyTypes`. Not security-relevant; leave for TA.2 follow-up.

### Session: 2026-05-11 - TA.2 Driver: IndexedDB schema + wrappers

- Added `src/data/schema.ts` — DB_NAME / DB_VERSION constants + STORES spec (single source of truth for upgrades). Documents the v1 → v2 (Phase I) rename of `books` → `sources` inline.
- Added `src/data/db.ts` — `openDb` (idempotent singleton, lazy, with onerror/onblocked rejection paths), `closeDb` (HMR-safe), `dbPut`/`dbGet`/`dbGetAll`/`dbGetByIndex`/`dbDelete`, `getSetting<T>`/`setSetting<T>`. ~95 LOC, well under arch limits.
- Five stores created on first open with indices: `books.addedAt`, `chapters.bookId`, `progress.bookId` + `progress.date`, `generated.chapterId`. Settings store keyed by `key` (not `id`).
- Added `src/data/db.test.ts` — 25 tests covering: schema constants, store/index creation, idempotent open, reopen-after-close, persistence-across-refresh roundtrip, put/get/overwrite/missing, getAll, getByIndex (bookId / date / chapterId), delete, error propagation (`onerror`, `onblocked`, transaction errors), settings round-trip (primitive, object, overwrite, missing, falsy).
- Coverage: stmts 100%, branches 92.1%, functions 94.44%, lines 100% — exceeds 90% AC.
- Added `src/test/setup.ts` with `fake-indexeddb/auto`; vitest now runs coverage via `@vitest/coverage-v8@2.1.9` with threshold gates.
- Wired `openDb()` into `src/main.ts` at boot (console.error on failure, no UI kill) and `import.meta.hot.dispose(() => closeDb())` so HMR full-page-reloads don't leak the DB connection.
- HMR smoke test: edited `db.ts`, Vite logged `page reload src/data/db.ts` cleanly — no errors.
- Verification:
  - `npm run typecheck` → clean
  - `npx vitest run --coverage` → 27/27 pass, thresholds green
  - `npm run build` → 66ms, 8 modules, 2.34 kB main chunk
  - `npm run dev` → HTTP 200 on `/`, `/src/main.ts`, `/src/data/db.ts`; HMR clean
  - `bpsai-pair arch check` → no violations on any of: db.ts, schema.ts, db.test.ts, main.ts, setup.ts
- Open decision resolved inline: chapter-ID format `<bookId>_ch_<index>` (legacy, per data-model.md) — encoded in test fixtures; enforced when TA.4 generates IDs.

### Session: 2026-05-11 - TA.1 Driver: Vite + TS + PWA scaffold

- Archived prior Phase-L monolith artifacts (482KB `index.html`, `src/`, `api/`, `scripts/`, `coverage/`, old `package.json` etc.) to `_legacy/phase-l-monolith/`. All untracked — git history unaffected. `_legacy/` added to `.gitignore`.
- Created fresh repo scaffold satisfying TA.1 AC:
  - `package.json` — Vite 5 + TS 5.6 + Vitest 2.1; scripts: `dev`, `build`, `preview`, `typecheck`, `test`, `test:watch`
  - `tsconfig.json` — strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noUnusedLocals/Parameters`
  - `vite.config.ts` — app mode (not lib mode), serves on :5173, builds to `dist/`
  - `index.html` — minimal Vite entry, loads `/src/main.ts`, links `/manifest.webmanifest` + `/icon.svg`
  - `src/main.ts` — bootstrap (mount + register SW)
  - `src/app.ts` — hello-world shell (`Headway — Phase A scaffold`)
  - `src/sw-register.ts` — production-only SW registration; suppressed in dev and with `?nosw=1`
  - `src/styles.css` — minimal dark theme tokens
  - `src/app.test.ts` — TDD smoke test (2 tests, both pass)
  - `public/manifest.webmanifest` — PWA manifest with id, scope, start_url, theme/background, icon
  - `public/sw.js` — minimal cache-first SW (richer impl in TA.9)
  - `public/icon.svg` — H logo (yellow on slate)
  - `vercel.json` — zero-config + explicit no-cache headers on sw.js/manifest, `Service-Worker-Allowed: /`
- Updated `README.md` with one-liner deploy (`vercel deploy --prod`), full script reference, and structure diagram
- Verification:
  - `npm install` → 44 pkgs OK
  - `npm run typecheck` → clean
  - `npm run build` → 55ms, 3 chunks, 2.78 kB total
  - `npm test` → 2/2 pass
  - `npm run dev` → HTTP 200 @ :5173, serves index + `/src/main.ts`
  - `npm run preview` → HTTP 200 @ :4173 for `/`, `/manifest.webmanifest` (correct content-type), `/sw.js`, `/icon.svg`
  - `bpsai-pair arch check` → no violations on any source file

### Session: 2026-05-11 - Sprint A Navigator plan

- Ran `/pc-plan .paircoder/plans/backlogs/phase-a.md`
- Pre-flight: budget healthy; Trello disabled → local-only / engage workflow
- Created plan `plan-2026-05-phase-a-foundation` (feature, story scope, 305 cx)
- Registered 10 tasks `TA.1` … `TA.10` via `bpsai-pair plan add-task` (priorities P0/P1, complexities 10-65)
- Wrote full task files in `.paircoder/tasks/` with Objective, Files to Update, Implementation Plan, AC (verbatim from backlog), Verification commands, and risk Notes
- Dependency graph: TA.1 → {TA.2, TA.3, TA.9}; TA.2 + TA.3 → TA.4 → TA.5 → TA.6 → TA.7; TA.2 + TA.3 → TA.8; TA.9 → TA.10
- Critical path: TA.1 → TA.2 → TA.4 → TA.9 → TA.10
- Open decisions surfaced to TA.2 (chapter-ID format `<bookId>_ch_<index>`) and TA.4/TA.9 (PDF.js worker self-hosting for offline)

### Session: 2026-05-11 - Full backlog scaffold

- Read all 25 phase docs in `docs/implementation-plan/`
- Generated `00-ROADMAP.md` with sprint order, dependencies, and 8 cross-sprint enforcement gates (G-AC, G-Tests, G-Arch, G-Security, G-Lighthouse, G-Migrate, G-Manual, G-State)
- Wrote 25 engage-compatible backlog files (`phase-a.md` through `phase-y.md`), one task per T-item from each phase doc
- Each backlog includes: H1 sprint title, phase markers, task IDs (`TA.1`, `TB.1`, etc.), complexity (`Cx:`), priority (`P0`/`P1`/`P2`/`P3`), AC checklists, dependencies, and inter-sprint enforcement gates
- All backlogs are engage-parseable (verified shape; dry-run pending engage invocation)
- 327 total tasks across 95 sub-phases ready for autonomous execution

### What's NOT done

- No coding started. The user explicitly requested backlog-only.
- No engage runs yet (no `engage/phase-*` branches; no PRs).
- No Trello board configured; if Trello sync needed later: `bpsai-pair trello use-board <board-id>` before any sync.

## What's Next

1. ✅ Navigator review pass done (`/pc-plan .paircoder/plans/backlogs/phase-a.md`) → `plan-2026-05-phase-a-foundation`
2. ✅ TA.1 shipped (Vite + TS + PWA scaffold; all AC met; dev/build/test/preview all green)
3. ✅ TA.2 shipped (IndexedDB v1 + five stores + wrappers + settings; 27 tests; coverage exceeds 90%; HMR clean)
4. ✅ Navigator re-plan validation pass (2026-05-11) — backlog reparsed, plan structure confirmed.
5. ✅ TA.2 finalized (2026-05-11) — typecheck cleanup done, ACs ticked, status flipped to `done`.
6. ✅ Navigator re-plan validation pass #3 (2026-05-12) — plan healthy, no replan needed; TA.2 working-tree regression and uncommitted audit-round-2 fixes flagged.
7. ✅ TA.2 re-finalized (2026-05-12) — task file restored to `status: done` with all 5 ACs ticked; full verification re-run (38/38 tests, db.ts branch 92.1%, typecheck/arch clean).
8. **Commit the working tree, then engage TA.3.**
   - State.md + `.paircoder/tasks/TA.2.task.md` carry the recovery; commit them with the 2026-05-12 audit-round-2 fixes (which may or may not still be in tree — re-check before staging).
   - Then: `/start-task TA.3` — App shell + view system (P0, Cx 5, depends only on TA.1)
8. **Outstanding housekeeping (non-blocking):**
   - Investigate why an engage-run hook is flipping `TA.2.task.md`'s status from `done` back to `failed` in the working tree. Likely the audit-circuit-breaker path tags the task as failed without checking that it was already done. Worth filing as a bpsai-pair bug after Sprint A.
   - Decide whether to delete the vestigial `plan-2026-05-phase-a-foundation.plan.yaml` (0 tasks linked, all task files reference `plan-sprint-0-engage` instead). Recommendation: keep `plan-sprint-0-engage` as the active plan since every task file already points to it — delete the 0-task duplicate to avoid future confusion. Optional / low-priority.
8. Sanity-parse engage version still available: `bpsai-pair engage .paircoder/plans/backlogs/phase-a.md --dry-run` (passes today).
9. After Sprint A merges: verify ALL enforcement gates green (see `00-ROADMAP.md`), then engage Sprint B.
10. Sprints H–Y remain locked until Sprint G (Architectural Rebuild) merges.

### Sprint A task order (critical path bold)

| Order | Task | Title | Pri | Cx | Depends on |
|---|---|---|---|---|---|
| 1 | **TA.1** ✅ | Project skeleton (Vite + TS + PWA scaffold) | P0 | 25 | — |
| 2 | **TA.2** ✅ | IndexedDB schema + wrappers | P0 | 40 | TA.1 |
| 3 | TA.3 | App shell + view system | P0 | 25 | TA.1 |
| 4 | **TA.4** | Add Book flow (PDF + EPUB) | P0 | 65 | TA.2, TA.3 |
| 5 | TA.5 | Library grid view | P1 | 25 | TA.3, TA.4 |
| 6 | TA.6 | Book detail view | P1 | 25 | TA.5 |
| 7 | TA.7 | Chapter view (Read mode only) | P1 | 25 | TA.6 |
| 8 | TA.8 | Settings modal | P1 | 10 | TA.2, TA.3 |
| 9 | **TA.9** | PWA manifest + service worker | P0 | 40 | TA.1, TA.3 |
| 10 | **TA.10** | Offline behavior verification | P0 | 25 | TA.9 |

## Blockers

None currently. The roadmap is ready to engage.

## Open Decisions (logged from phase docs — resolve before engaging)

- **Pre-A:** Framework choice locked? (Vite + TS recommended.)
- **Pre-B:** IDB schema keys + chapter-ID format locked? Cache pattern `<type>_<chapterId>` locked?
- **Pre-G:** Framework re-confirmation (SvelteKit / Next / Solid Start) before committing weeks of work
- **Pre-H:** JSON import format finalized? (See `docs/22-import-file-format.md`)
- **Pre-U:** Default cloud, mandatory encryption?
- **Pre-Y:** Pick-and-choose subset (don't commit to all 23 tasks at once)

## Quick Commands

```bash
# Status
bpsai-pair status

# List the backlog files
ls .paircoder/plans/backlogs/

# Dry-run a sprint to verify parser
bpsai-pair engage .paircoder/plans/backlogs/phase-a.md --dry-run

# Run a sprint for real
bpsai-pair engage .paircoder/plans/backlogs/phase-a.md

# Resume an interrupted sprint
bpsai-pair engage .paircoder/plans/backlogs/phase-a.md --resume

# After a sprint completes — verify state.md was updated
cat .paircoder/context/state.md | head -20
```
