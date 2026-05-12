# Sprint G: Architectural Rebuild — TS strict, Vite, modular, workers, OPFS, Dexie, tests

> One task per T-item in `docs/implementation-plan/phase-g-architectural-rebuild.md`.
> **Foundational pivot.** Phases H–Y all assume the modular TypeScript codebase delivered here.
> Goal: migrate single-file PWA into a proper modular codebase WITHOUT reducing user-facing functionality and WITHOUT forcing users to re-import their library.

### Phase 1: Tooling, CI, structure, types

### TG.1 -- Tooling and CI setup | Cx: 13 | P0

**Description:** `pnpm` workspace. `vite` + `vite-plugin-pwa`. `tsconfig.json` strict mode. `eslint` + `prettier`. GitHub Actions: lint+format on PR, Vitest run, Playwright run, Lighthouse budget check, Vercel preview deploy.

**AC:**
- [ ] `pnpm install && pnpm build` produces a deployable bundle
- [ ] CI pipeline runs all 5 gates on every PR
- [ ] Lighthouse budget defined in `lighthouserc.json` and enforced
- [ ] Vercel preview deploys per PR with a comment-bot link
- [ ] TS strict-mode on; zero errors at sprint start

**Depends on:** None

### TG.2 -- Folder structure (src/* layout) | Cx: 5 | P0

**Description:** Per `docs/25-rebuild-blueprint.md`: `src/app/` (routes), `src/modes/` (one folder per reading mode), `src/providers/` (AI/TTS/image/video/sync), `src/pipeline/` (extract/OCR/chapter detect/clean), `src/data/` (Dexie + repos + zod), `src/ui/` (design system + player + PDF viewer), `src/workers/` (PDF/OCR/search/crypto), `src/lib/` (prompts/markdown/ids/utilities), `src/api/` (Vercel edge functions).

**AC:**
- [ ] All 8 directories created with `README.md` describing intent
- [ ] Each module exposes a barrel `index.ts` so import paths stay short
- [ ] No file > 400 lines (sources) or > 600 lines (tests) — enforced by `bpsai-pair arch check`

**Depends on:** TG.1

### TG.3 -- TypeScript types (zod schemas) | Cx: 8 | P0

**Description:** Schema as zod (runtime + type): `Book`, `Chapter`, `Progress`, `Generated`, `Settings`. `z.infer` exports the TS types.

**AC:**
- [ ] All 5 schemas exported with `z.infer` types
- [ ] Schemas tested against existing IDB fixtures
- [ ] Schema mismatches surface as type errors at compile time
- [ ] Runtime validation gates IDB writes during migration

**Depends on:** TG.2

### Phase 2: Data layer + OPFS + workers

### TG.4 -- Dexie migration v1 → v2 | Cx: 21 | P0

**Description:** `HeadwayDB extends Dexie` with typed Tables. v1 stores; v2 upgrade moves `pdfData` from `books` table into OPFS, writes `book.pdfRef` and removes `book.pdfData`. **Backup-first strategy**: copy entire v1 IDB to a v1-backup database before mutating.

**AC:**
- [ ] Existing user (v1 IDB) upgrades to v2 with zero data loss
- [ ] Backup written to `<dbname>-v1-backup` before migration runs
- [ ] Vitest fixtures: 1MB book, 50MB book, 200MB library — all migrate cleanly
- [ ] Migration is idempotent (running v2 logic twice is a no-op)
- [ ] Rollback recipe documented (restore from backup, drop v2)

**Depends on:** TG.3

### TG.5 -- OPFS module | Cx: 8 | P0

**Description:** `src/data/opfs.ts` with `write`, `read`, `delete`, `exists`. Supports modern browsers; fallback to IDB blob storage for older Safari (< 15.2).

**AC:**
- [ ] All four methods covered by Vitest (mocking OPFS where needed)
- [ ] Fallback path tested with `caniuse` matrix (iOS 14, 15.2+, Chrome 102+)
- [ ] Large file (50MB) round-trip preserves bytes
- [ ] Errors surface as typed exceptions

**Depends on:** TG.3

### TG.6 -- Provider plugin contracts | Cx: 13 | P0

**Description:** Define `CallAIPlugin`, `TTSPlugin`, `ImagePlugin`, `VideoPlugin`, `SyncPlugin` interfaces. Registry per provider type (`aiProviders[id]`). `callAI(args)` dispatches via `getSetting('aiProvider')`. Implementations: `gemini.ts`, `merlin.ts`, `junia.ts`, `docanalyzer.ts` (perplexity added in K).

**AC:**
- [ ] All 5 plugin interfaces published with TSDoc
- [ ] Registry pattern enforced (no direct provider calls outside `callAI` / etc.)
- [ ] Gemini provider passes its full Vitest from sprint B
- [ ] `hasAnyAIProvider()` correctly reflects provider configuration
- [ ] Type-level: each plugin's `call` shape is reused across all 5 providers

**Depends on:** TG.3, TG.2

### TG.7 -- Web Workers via Comlink | Cx: 13 | P0

**Description:** Workers: `pdf.worker.ts`, `ocr.worker.ts`, `chapter-detect.worker.ts`, `search.worker.ts`, `crypto.worker.ts`. Each wraps Comlink. Main thread uses `Comlink.wrap` typed bindings.

**AC:**
- [ ] All 5 workers compile and load with `{ type: 'module' }`
- [ ] PDF text extraction in worker matches main-thread baseline
- [ ] Main-thread freeze time < 16ms during heavy ops (verified by tracing)
- [ ] Bundle includes workers as separate chunks
- [ ] Fallback: if worker fails to load, main thread handles op + logs warning

**Depends on:** TG.6

### Phase 3: Helper extraction, sanitization, tests

### TG.8 -- Markdown + DOMPurify | Cx: 5 | P1

**Description:** Replace in-house `formatContent`/`sanitizeHtml` with `marked` + DOMPurify. `renderMarkdown(text)` exported from `src/lib/markdown.ts`.

**AC:**
- [ ] All XSS fixtures from sprint B/C still pass under DOMPurify
- [ ] Markdown rendering matches in-house output for 20+ fixtures
- [ ] No regression on AI output sanitization
- [ ] Bundle size delta documented in PR

**Depends on:** TG.2

### TG.9 -- Pure helper extraction & tests | Cx: 8 | P1

**Description:** Move to `src/lib/`: `parse-feed-json.ts`, `merge-array-by-id.ts`, `split-text-into-chunks.ts`, `format-number.ts`, `format-time.ts`, `time-ago.ts`, `array-buffer-base64.ts`. Each gets `*.test.ts`. Target ≥ 80% line coverage on `lib/`.

**AC:**
- [ ] All 7 helpers extracted with TSDoc + unit tests
- [ ] `lib/` coverage ≥ 80% line
- [ ] No helper imports outside `lib/` (no circular deps)
- [ ] Each helper documented with example in TSDoc

**Depends on:** TG.2

### TG.10 -- Playwright e2e tests | Cx: 13 | P0

**Description:** Fixtures: `simple-novel.epub`, `scanned-paper.pdf`, `multi-column-textbook.pdf`. Test flows: library import → read; quiz answer 3 → score; listen play/pause; sync (mocked) upload → download fresh profile; PDF viewer highlight → save annotated. Snapshot tests for markdown + JSON parser.

**AC:**
- [ ] All 5 flows green on CI
- [ ] Snapshot diffs visible in PR
- [ ] Tests run < 10 minutes on CI runner
- [ ] Headless and headed both supported

**Depends on:** TG.4, TG.6, TG.7

### Phase 4: Bundle, SW, error logging, migration UX

### TG.11 -- Bundle splitting | Cx: 8 | P1

**Description:** Verify with `npm run build`: Library ≤ 150 KB gzipped; PDF viewer ≤ 300 KB additional; Listen ≤ 150 KB additional; Settings ≤ 100 KB additional. CI gate fails PR on budget exceedance.

**AC:**
- [ ] All 4 budgets met on current code
- [ ] CI fails when a PR exceeds a budget
- [ ] Bundle analyzer report attached to PR
- [ ] Route-based code splitting documented

**Depends on:** TG.10

### TG.12 -- Service worker upgrade | Cx: 5 | P1

**Description:** `vite-plugin-pwa`'s Workbox SW with auto-versioning (build hash), same API allowlist, manual update dialog (no `skipWaiting`).

**AC:**
- [ ] SW hash changes per build
- [ ] Manual "Apply Update" dialog works
- [ ] API allowlist unchanged in behaviour
- [ ] Offline behaviour parity with sprint A
- [ ] No silent auto-update

**Depends on:** TG.11

### TG.13 -- Sentry-compatible error logging | Cx: 5 | P2

**Description:** `src/lib/telemetry.ts`: `logError(e, context)` appends to local error array + `db.errors.add` (new IDB store). If `sentry.dsn` set, also captureException. Settings: optional DSN (default off). "Diagnostics" page in Settings shows local error log + DB stats + memory estimate.

**AC:**
- [ ] Local error log persists across reload
- [ ] DSN-off keeps everything device-local
- [ ] DSN-on hits Sentry endpoint (verify with test DSN)
- [ ] Diagnostics page renders without crashing on a fresh profile

**Depends on:** TG.4

### TG.14 -- Migration UX (one-time splash) | Cx: 5 | P0

**Description:** First-time v2 launch: detect v1 IDB → splash "Upgrading your library…" → run v2 migration (move PDFs to OPFS, normalize types) → "Done" → reload. Test on profile imported via sprint A app.

**AC:**
- [ ] Splash blocks app load until migration completes
- [ ] Migration runs once and never again (idempotency-checked)
- [ ] Error during migration shows recovery instructions + backup-restore commands
- [ ] Manual test passes on real device with 50MB library

**Depends on:** TG.4

### TG.15 -- Documentation refresh | Cx: 3 | P2

**Description:** Migrate `docs/01-overview.md` etc. to reflect the new layout. Phase docs stay valid (they describe "what", not file structure). Add `docs/25-rebuild-blueprint.md` reference everywhere relevant.

**AC:**
- [ ] Top-level docs reference new layout
- [ ] No stale "single-file architecture" references remain
- [ ] Blueprint doc kept in sync with actual `src/` layout

**Depends on:** TG.2

### TG.16 -- Performance targets verified | Cx: 5 | P1

**Description:** After rebuild: cold load on slow 3G iPhone ≤ 3s TTI; Library route ≤ 150KB gzipped; 200MB library uses ≤ 200MB main-thread peak; PDF viewer renders 600-page textbook without OOM.

**AC:**
- [ ] Lighthouse TTI ≤ 3s on simulated slow 3G
- [ ] Memory profile attached to PR with before/after
- [ ] PDF viewer fixture (600-page textbook) renders end-to-end
- [ ] Bundle sizes match budgets

**Depends on:** TG.11, TG.7

---

## Sprint enforcement gates (must pass before Sprint H begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Migrate** — v1 → v2 migration tested with backup-first; no user re-imports
- [ ] **G-Tests** — ≥ 80% coverage on `lib/`; Playwright e2e green
- [ ] **G-Arch** — `arch check src/` clean; file sizes within limits
- [ ] **G-Manual** — All Phase A–F features still work identically (full smoke test)
- [ ] **G-Lighthouse** — PWA score ≥ 95 (was 90 baseline)
- [ ] **G-Security** — DOMPurify replaces in-house sanitizer; XSS suite green
- [ ] **G-State** — `state.md` updated; `25-rebuild-blueprint.md` matches reality

**Decision points before Sprint H:**

- [ ] Confirm framework choice (SvelteKit / Next / Solid Start) — locks in before committing weeks of work
- [ ] Decide whether prompts move to `lib/prompts/<key>.md` files (recommended yes)
- [ ] Decide whether DOMPurify fully replaces in-house sanitizer or coexists
- [ ] Decide Sentry default: opt-in (recommended) or always-off

> **PIVOT NOTE:** Sprints H–Y are blocked until Sprint G ships. No exceptions.
