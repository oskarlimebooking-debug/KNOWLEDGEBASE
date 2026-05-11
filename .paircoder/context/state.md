# Current State

> Last updated: 2026-05-11

## Active Plan

**Plan:** Headway × ThesisCraft — Full Engage Roadmap (Phases A–Y)
**Status:** Sprint A planned; 10 tasks ready to engage
**Current Sprint:** A (Foundation) — planned, not yet started
**Active PairCoder plan:** `plan-2026-05-phase-a-foundation` (story scope, 305 cx, 10 tasks)

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
3. TA.2 + TA.3 unlock now. Run them in parallel:
   - `/start-task TA.2` — IndexedDB schema + wrappers (P0, cx 40)
   - `/start-task TA.3` — App shell + view system (P0, cx 25)
4. Sanity-parse engage version still available: `bpsai-pair engage .paircoder/plans/backlogs/phase-a.md --dry-run`
5. After Sprint A merges: verify ALL enforcement gates green (see `00-ROADMAP.md`), then engage Sprint B
6. Sprints H–Y remain locked until Sprint G (Architectural Rebuild) merges

### Sprint A task order (critical path bold)

| Order | Task | Title | Pri | Cx | Depends on |
|---|---|---|---|---|---|
| 1 | **TA.1** ✅ | Project skeleton (Vite + TS + PWA scaffold) | P0 | 25 | — |
| 2 | **TA.2** | IndexedDB schema + wrappers | P0 | 40 | TA.1 |
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
