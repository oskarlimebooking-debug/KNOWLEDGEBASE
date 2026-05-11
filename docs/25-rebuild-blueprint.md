# 25 — Rebuild Blueprint (Phase G Implementation Spec)

This document describes the architectural rebuild that **Phase G**
delivers. Pre-merger this was a forward-looking proposal; post-merger it
is the **committed implementation specification** for the modernization
foundation that all subsequent phases (H–Y) depend on.

The constraints are unchanged from the legacy single-file Headway:

- Static-host deployment (Vercel, Netlify, CF Pages, plain S3 + CloudFront)
- PWA (offline-first, installable, app-shell pattern)
- Bring-your-own API keys
- No backend for user data (everything is IDB + user's own Drive)
- Single-user app (no auth, no multi-tenant model)
- One-developer ergonomics (no enterprise CI/CD)

What changes: the codebase moves from one 26 000-line `index.html` to a
TypeScript + Vite + feature-sliced module structure with workers, OPFS,
and tests.

---

## North-star principles

1. **Static + edge functions only.** No long-running backend. All AI
   calls go through Vercel serverless proxies (CORS bypass, rate-limit
   shielding, no key storage).
2. **Modular by feature.** One folder per pillar (library, discovery,
   writing) and one folder per reading mode within library.
3. **Strict TypeScript throughout.** No `any`, no implicit casts, no
   `@ts-ignore` outside escape hatches.
4. **Plugin contracts for replaceable services.** AI provider, TTS,
   image, video, sync each implement a contract; users can swap
   implementations.
5. **Never block main thread.** Heavy work (OCR, chapter detection,
   search index, PDF render) runs in Web Workers via Comlink.
6. **OPFS for binaries.** PDFs and audio blobs live in Origin Private
   File System, not in IDB heap.

---

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **React 19** (with Suspense) or SvelteKit | React for ecosystem; SvelteKit for smallest bundles. Phase G picks based on team familiarity. |
| Language | **TypeScript strict** | Catches an entire class of bugs before runtime. |
| Bundler | **Vite + Rollup** | Code splitting, tree shaking, lazy loading of pillars and reading modes. |
| Styling | **Tailwind CSS 4** + design tokens | Light/dark/sepia themes via CSS variables. |
| State | **Zustand** + **TanStack Query** | Zustand for UI state; TanStack Query for AI calls (cache, stale time). |
| DB | **Dexie.js** | Typed IDB wrapper, migrations, observable LiveQuery. |
| Workers | **Comlink** | Ergonomic Web Worker boundaries with type-safe RPC. |
| File storage | **OPFS** (built-in) | Native sync API for large files; avoids IDB heap inflation. |
| Edge | **Vercel Functions** (or Cloudflare Workers) | Streaming, low-latency, free tier covers a single user. |
| Tests | **Vitest** + **Playwright** | Unit + e2e. |
| Sanitizer | **DOMPurify** | Hardened XSS protection on all user-rendered HTML. |
| API | **tRPC** (optional) | If we add a backend later, tRPC gives shared types. |

---

## Data model improvements

- **UUID v7** for all new IDs (sortable, globally unique). Legacy IDs
  (`book_<ts>`, `proj_<ts>`) accepted via migration.
- **Split PDF binary into OPFS** (never inflated to base64 in JS heap).
- **Eliminate `content`/`text` duplication** on chapters (one field:
  `content`). One major version of dual-write, then drop.
- **Versioned migrations via Dexie** (not hand-rolled).

See [`03-data-model.md`](03-data-model.md) for the full post-Phase-G
schema.

---

## Pipeline architecture

```
       ┌──────────────────────────────────────────────────┐
       │   Library import (Source files)                  │
       └──────────────────┬───────────────────────────────┘
                          │
            DAG of pure stages, in a worker:
            ┌─ extract  →  clean  →  detect chapters  →  store ─┐
            │                                                    │
            └────── persists intermediate state per stage ───────┘
                          │
                  resume-on-reload
                          │
                          ▼
                   Source + Chapters
```

Each stage is independently testable, with input/output contracts. A
crashed pipeline can resume from the last persisted stage rather than
restarting from scratch.

---

## Plugin contracts

Five interfaces; users can swap implementations.

```ts
// AI provider
interface CallAIPlugin {
  id: string;
  displayName: string;
  call(prompt: string, options: CallAIOptions): Promise<string>;
  callStream?(prompt: string, options: CallAIOptions): AsyncGenerator<string>;
  listModels?(): Promise<ModelInfo[]>;
}

// TTS
interface TtsPlugin {
  id: string;
  synthesize(text: string, options: TtsOptions): Promise<AudioData>;
  voices(): Promise<VoiceInfo[]>;
  cleanup?(): void;
}

// Image
interface ImagePlugin {
  id: string;
  generate(prompt: string, options: ImageOptions): Promise<DataURL>;
}

// Video
interface VideoPlugin {
  id: string;
  generate(script: string, options: VideoOptions): Promise<{ url: string; pollUntil?: () => Promise<URL> }>;
}

// Sync
interface SyncPlugin {
  id: string;
  upload(snapshot: SyncSnapshot): Promise<void>;
  download(): Promise<SyncSnapshot>;
  delta?(since: string): Promise<DeltaPatch>;
}
```

Implementations live in `src/providers/<kind>/<vendor>.ts` and register
themselves with the registry on load.

---

## Sync redesign

Replace the giant single JSON with **per-store delta sync**:

```
appData/
├── chapterwise-sync.json         # legacy v1 envelope (deprecated, dual-write for 1 release)
├── manifest.json                 # v2 entry point, lists all stores
├── sources.metadata.json         # source metadata (no PDF binaries)
├── sources/
│   ├── src_x.pdf.bin             # PDF binaries (one file per source, cacheable)
│   └── src_x.cover.jpg
├── chapters.delta.json           # chapter rows
├── progress.delta.json           # progress rows
├── generated/<chapterId>/*.json  # AI artefacts
├── projects.delta.json
├── project_sections.delta.json
├── citations.delta.json
├── discovery_results.delta.json
├── research_feedback.delta.json
├── writing_exercises.delta.json
└── settings.json
```

Benefits:
- Per-store sync (don't re-upload entire library when one chapter changes)
- PDFs are independent files (Drive can cache, browser can download just one)
- Selective sync (skip generated for a fresh device that wants fast start)

Phase U delivers this. Phase G ships the v1 envelope unchanged for
forward compatibility.

---

## UI architecture

- **Real client-side routing** (`/library`, `/source/:id`, `/chapter/:id/:mode`,
  `/discovery`, `/writing`, ...) — pre-Phase-G used class toggles.
- **Modal stack** independent of routes (a modal opens over any view).
- **Persistent player** as a fixed top-level component (not inside a
  pillar).
- **Error boundaries** per mode (a broken Quiz mode doesn't crash the
  whole chapter view).
- **Suspense + lazy** for code splitting (each reading mode is a chunk;
  PDF.js is lazy-loaded).

---

## Performance budgets

| Metric | Budget |
|---|---|
| Initial bundle | ≤ 150 KB gzipped |
| Time-to-interactive (cold load, slow 3G) | ≤ 3 s |
| PDF viewer chunk | ≤ 800 KB additional, lazy |
| Main thread memory (sustained, iOS) | ≤ 100 MB |
| Web Worker memory (per worker) | ≤ 100 MB |
| First paint | ≤ 1 s |

Bundle analyzer in CI flags any PR that breaks budgets.

---

## Testing strategy

1. **Pure functions first** (`src/lib/`). 100% coverage:
   - `parseFeedJson`, `mergeBoundaries`, `markdown.render`, `sanitizer`,
     `arrayBufferBase64`, `streakCalc`, `citationKey`, `csl.format`
2. **Worker flows** via Comlink mocks (Vitest):
   - OCR pipeline stages
   - Chapter detection
   - Search indexing
3. **E2E on fixture sources** (Playwright):
   - Import a small PDF, verify chapter list
   - Generate summary, verify cache key
   - Switch reading mode, verify mode renders
   - Create project, import sections, edit one section
   - Run Discovery (with mocked Perplexity) and verify results
4. **Visual regression** on key screens (Playwright + axe-core for a11y)
5. **No mocking of IDB** — Vitest + fake-indexeddb for IDB tests

CI runs on every PR. PRs blocked on test failures.

---

## Observability

- **Local telemetry store** (IDB) — errors, slow operations, sync stats
- **Diagnostics page** in Settings — exports the telemetry log as JSON
- **Optional Sentry-compatible opt-in** — user enables a checkbox, errors
  forward to a configured endpoint (defaults to off)
- **Performance marks** for key flows (import, generation, sync)

---

## Security

- **DOMPurify** sanitizes all imported HTML and AI-generated HTML
- **Never `innerHTML`** without sanitization (lint rule)
- **CSP** headers configured tightly
- **Encrypt sync** with user passphrase via libsodium (Phase U)
- **No secrets in repo** — `.env` for proxy-side rate-limit tokens only
- **API key handling** — keys live in IDB, never logged, never sent to
  any server except the proxy that needs them

---

## Migration path

```
v1 IDB schema (pre-Phase-G)
   │
   ▼
Phase G: dual-write (v1 + v2) for one release
   │
   ▼
Phase G: complete migration; v1 IDB readonly fallback
   │
   ▼
Phase H+I: new stores added; PDF binaries migrate to OPFS
   │
   ▼
Phase L+O+P+Q: more stores added
   │
   ▼
Phase U: per-store delta sync replaces single JSON
```

The migration runs in a Web Worker on app boot; the user sees a one-time
"Migrating your library…" screen. Pre-migration backup exported
automatically.

---

## Phase split: Reader vs Studio

The deepest cut: split into two products sharing infrastructure.

- **Headway Reader** — library, PDF, TTS, basic reading modes
  (Read, Listen, Ask, Summary). Smallest bundle. Free tier.
- **Headway Studio** — quiz, feed, mind-map, video, Writing Hub,
  Discovery, Citations. Larger bundle. Paid tier (or BYO API keys).

Same data model, same sync. Reader is a subset of Studio in code; Studio
imports the Reader chunks dynamically.

Not committed for Phase G; floated as a future option once feature surface
stabilizes.

---

## Phase G acceptance criteria

Phase G is "done" when:

- All pre-merger Headway functionality (READ pillar) works in the new
  modular stack
- All tests pass; coverage ≥ 80% on `src/lib/`
- Bundle size meets budget (initial ≤ 150 KB gzipped)
- Migration from v1 → v2 IDB works on a real-user library (≥ 50 sources)
- E2E tests cover the import → read → generate-summary → sync flow
- DOMPurify sanitizes all rendered HTML
- Service worker is Workbox-generated (no manual cache-version bumps)

After Phase G ships, all subsequent phases (H–Y) build on this
foundation. Pre-Phase-G features are frozen on a `legacy-singlefile`
branch for reference.

---

## Continue reading

- Architecture: [`02-architecture.md`](02-architecture.md)
- Phase G implementation: see `implementation-plan/phase-g-architectural-rebuild.md`
- Future roadmap: [`24-future-development.md`](24-future-development.md)
