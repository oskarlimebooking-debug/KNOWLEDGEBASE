# 02 — Architecture

This document describes the architecture of the merged Headway app —
both the pre-Phase-G single-file shape (legacy) and the post-Phase-G
modular shape (new foundation for all merger features).

---

## Bird's-eye view (post-Phase-G)

```
                    ┌──────────────────────────────────┐
                    │  Browser PWA (TS + Vite build)   │
                    └─────────────┬────────────────────┘
                                  │
   ┌──────────┬──────────┬────────┼──────────┬──────────┬──────────┐
   ▼          ▼          ▼        ▼          ▼          ▼          ▼
 IndexedDB  OPFS    SW + Cache  Drive    AI APIs   Vercel     Workers
 (Dexie)   (PDFs)  (Workbox)   (appData) (5 svcs)  Functions  (Comlink)
                                            │           │          │
                                            ▼           ▼          ▼
                                Vadoo, Lazybird, DocAnalyzer,  OCR,
                                Merlin, Junia, Gemini, GTTS,   chapter
                                Perplexity, CrossRef, OpenAlex detection,
                                                               search
```

The static-host story is preserved — `vite build` produces a folder of
static assets servable from any CDN (Vercel, Netlify, CF Pages,
GitHub Pages). The service worker (Workbox-generated) caches the assets
and serves offline.

---

## Three pillars × shared infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                    Top-level navigation                         │
│   [📚 Library]  [🔬 Discovery]  [✏️ Writing]  [⚙ Settings]      │
└─────────────────────────────────────────────────────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
   READ pillar   RESEARCH pillar  WRITE pillar   Cross-cutting
   src/pillars/  src/pillars/     src/pillars/   src/lib/, src/providers/
   library/      discovery/       writing/
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                            │
                   shared services and stores
                   src/data/, src/workers/, src/lib/
```

Each pillar is a self-contained folder with its own components, hooks,
state stores, and routes. Shared services (callAI, sync, OCR) live in
`src/lib/` and `src/providers/`.

---

## Folder layout (post-Phase-G)

```
src/
├── main.tsx                  # entry; routes; theme provider
├── App.tsx                   # top-level shell + persistent player + nav
│
├── pillars/
│   ├── library/              # READ pillar
│   │   ├── routes/
│   │   │   ├── LibraryRoute.tsx
│   │   │   ├── SourceRoute.tsx           # was BookRoute
│   │   │   └── ChapterRoute.tsx
│   │   ├── components/        # SourceCard, KindFilter, Tags, etc.
│   │   ├── modes/             # one folder per reading mode
│   │   │   ├── read/
│   │   │   ├── listen/        # uses TTS provider plugins
│   │   │   ├── ask/
│   │   │   ├── summary/
│   │   │   ├── quiz/
│   │   │   ├── flashcards/
│   │   │   ├── teach/
│   │   │   ├── socratic/
│   │   │   ├── mindmap/
│   │   │   ├── feed/
│   │   │   └── video/
│   │   └── importing/         # ingestion pipeline
│   │
│   ├── discovery/             # RESEARCH pillar
│   │   ├── routes/DiscoveryRoute.tsx
│   │   ├── components/SearchSuggestionCard, RelevanceBadge, ...
│   │   ├── pipeline/          # 3-step pipeline (Step1 query, Step2 perplexity, Step3 analyze)
│   │   ├── feedback/          # research_feedback store + helpers
│   │   └── cache/             # 24h Perplexity cache
│   │
│   └── writing/               # WRITE pillar
│       ├── routes/
│       │   ├── WritingHubRoute.tsx
│       │   ├── OutlineRoute.tsx
│       │   └── SectionEditorRoute.tsx
│       ├── components/SectionEditor, OutlineTree, ProgressRing, ...
│       ├── exercises/         # 6 exercise types as components
│       ├── citations/         # citation picker, bibliography renderer
│       └── streaming/         # NDJSON parser, abort wiring
│
├── providers/                 # plugin contracts + implementations
│   ├── ai/
│   │   ├── CallAIPlugin.ts    # interface
│   │   ├── gemini.ts
│   │   ├── merlin.ts
│   │   ├── junia.ts
│   │   ├── docanalyzer.ts
│   │   ├── perplexity.ts      # NEW Phase K
│   │   └── registry.ts
│   ├── tts/                   # 3 TTS plugins
│   ├── image/                 # Gemini image-out, Bonkers
│   ├── video/                 # Vadoo
│   └── sync/                  # Drive (existing), Dropbox, OneDrive (Phase U)
│
├── data/
│   ├── db.ts                  # Dexie typed schema
│   ├── migrations/            # versioned migrations (v1 → v2 etc.)
│   ├── stores/
│   │   ├── sources.ts         # was books
│   │   ├── chapters.ts
│   │   ├── progress.ts
│   │   ├── generated.ts       # AI cache
│   │   ├── settings.ts
│   │   ├── projects.ts        # NEW Phase H
│   │   ├── projectSections.ts # NEW Phase H
│   │   ├── discoveryResults.ts # NEW Phase L
│   │   ├── researchFeedback.ts # NEW Phase L
│   │   ├── discoveryCache.ts  # NEW Phase L
│   │   ├── writingExercises.ts # NEW Phase P
│   │   └── citations.ts       # NEW Phase Q
│   └── opfs/                  # OPFS-backed PDF storage
│
├── workers/                   # Web Workers (Comlink)
│   ├── ocr.worker.ts
│   ├── chapterDetect.worker.ts
│   ├── searchIndex.worker.ts
│   └── pdfRender.worker.ts
│
├── lib/                       # pure helpers (highly tested)
│   ├── parseFeedJson.ts
│   ├── mergeBoundaries.ts
│   ├── markdown.ts            # in-house renderer
│   ├── sanitizer.ts           # DOMPurify wrapper
│   ├── arrayBufferBase64.ts
│   ├── streakCalc.ts
│   ├── citationKey.ts         # BibTeX key gen
│   ├── csl.ts                 # citation style language
│   └── ...
│
├── ui/                        # design system (post-Phase-T)
│   ├── tokens.css             # design tokens (colors, spacing, fonts)
│   ├── components/Button, Modal, Toast, ...
│   └── icons/
│
└── routes.ts                  # route map for SvelteKit/React Router

api/                           # Vercel serverless functions
├── docanalyzer/proxy.ts
├── vadoo/proxy.ts
├── perplexity/proxy.ts        # NEW Phase K
├── lookup/
│   ├── doi.ts                 # CrossRef wrapper
│   └── openalex.ts            # OpenAlex wrapper
├── generate/
│   ├── stream.ts              # NDJSON streaming (Phase O)
│   └── index.ts               # one-shot Gemini wrapper
└── analyze.ts                 # article relevance analysis (Phase L)
```

---

## In-app routing

Real client-side routing (post-Phase-G uses React Router or SvelteKit):

| Path | Pillar | Component |
|---|---|---|
| `/library` | READ | `LibraryRoute` |
| `/library?kind=article` | READ | filtered library |
| `/source/:id` | READ | `SourceRoute` (was BookRoute) |
| `/chapter/:id/:mode?` | READ | `ChapterRoute` with mode tab |
| `/discovery` | RESEARCH | `DiscoveryRoute` (latest sub-tab) |
| `/discovery/favorites` | RESEARCH | favorites |
| `/discovery/history` | RESEARCH | history |
| `/writing` | WRITE | `WritingHubRoute` (dashboard) |
| `/writing/outline` | WRITE | `OutlineRoute` |
| `/writing/section/:id` | WRITE | `SectionEditorRoute` |
| `/settings` | shared | `SettingsRoute` |
| `/sources` | shared | global Source library (cross-project) |

Modal stack is independent of the route.

---

## State management (post-Phase-G)

- **TanStack Query** for AI calls and Drive sync (cache, stale time,
  background refetch)
- **Zustand** stores per pillar:
  - `useLibraryStore` — current source, current chapter, current mode
  - `useDiscoveryStore` — current batch, sub-tab, sort order
  - `useWritingStore` — current section, draft state, exercise state
  - `usePlayerStore` — persistent audio player state (cross-pillar)
  - `useProjectStore` — active project (cross-pillar)
  - `useSettingsStore` — settings cache (synced with IDB on writes)
- **Dexie LiveQuery** for reactive IDB reads (alternative to manual
  re-read on mount)

The mutable globals from the legacy single-file architecture are
decomposed into these stores.

---

## Render pipeline (per chapter)

1. User navigates to `/chapter/:id/:mode`.
2. `ChapterRoute` reads `chapter`, `source`, and the cached `generated`
   row for the requested mode.
3. If cached, renders immediately.
4. If missing, mounts a `<Loading mode="quiz" />` and dispatches the
   generator via TanStack Query (with stale-while-revalidate semantics).
5. Generator calls the active AI provider via `callAI` (the unified
   dispatcher). Successful results write to `generated` store.
6. UI updates reactively via Dexie LiveQuery.

---

## Render pipeline (Discovery)

1. User taps "Search Now" in `/discovery`.
2. `DiscoveryRoute` shows skeleton cards and starts the 3-step pipeline.
3. Step 1 (Gemini): `callAI(...)` with `provider: 'gemini'`, JSON mode.
4. Step 2 (Perplexity): three parallel `callAI(...)` with
   `provider: 'perplexity'`, results deduped.
5. Step 3 (Gemini): per-result `callAI(...)` with cache lookup first.
6. Results saved to `discovery_results`. UI updates via Dexie LiveQuery.

---

## Render pipeline (Writing draft generation)

1. User taps "Generate Draft" in `/writing/section/:id`.
2. `SectionEditorRoute` builds the prompt (project context, outline,
   sources, content).
3. Fetches `/api/generate/stream` with NDJSON streaming.
4. Updates `streamedText` state token-by-token.
5. On done, persists `aiDraft` via debounce.

See [`33-streaming-ai-and-ndjson.md`](33-streaming-ai-and-ndjson.md) for
protocol details.

---

## Persistent player (cross-pillar)

The audio mini-player is mounted at the App shell level, not within any
pillar. It survives pillar navigation. Implementation:

- `usePlayerStore` (Zustand) holds `isPlaying`, `currentChapter`,
  `currentSource`, `progress`, `provider`.
- A single `<audio>` element per provider (Lazybird, Google TTS) — reused
  for sequential playback to avoid iOS memory pressure.
- `MediaSession` API for lockscreen / notification controls.
- Browser TTS uses `speechSynthesis` (no `<audio>` element needed).

---

## Background processing

Web Workers (via Comlink) for:

- **OCR cleaning** — large texts processed off-main-thread
- **Chapter detection** — sequential AI chunking with progress updates
- **Search index** (Phase T) — lunr.js full-text indexing
- **PDF rendering** — heavy PDF.js work (decode, rasterize) off-thread

Workers communicate via Comlink RPC; main thread orchestrates progress UI.

---

## Concurrency model

- Most flows are `async` but **single-track**: one batch processing loop,
  one audio element per provider, one sync at a time (gated by Zustand
  flag).
- Batch import queue processes one item at a time to keep memory bounded
  and API quotas calm.
- Discovery's 3-step pipeline uses `Promise.allSettled` for parallel
  Perplexity and Gemini-analyze fan-out.
- Drive sync uses abort controllers (download timeout 60s, upload 120s).

---

## Error handling philosophy

- Generators show a user-visible "Failed to generate X" empty state on
  error but never crash the page.
- All exceptions funnel to `showToast(msg, 'error')`.
- AI calls have explicit timeouts and fall back to less ambitious paths
  (e.g. chapter detection falls back from AI to word-count split).
- Streaming endpoints emit `{error: "..."}` lines on mid-stream failure;
  the client preserves partial output and warns.
- Drive sync 401 revokes token and prompts re-auth.

---

## Build / deploy

- `npm install` + `npm run dev` for local development (Vite hot reload).
- `npm run build` produces a static-deployable `dist/` folder.
- Vercel auto-deploys on push to `main`. `api/` folder picked up as
  serverless functions.
- Service worker (Workbox-generated) versioned automatically by Workbox
  build hash — no more manual cache version bumps.

---

## Security

- **DOMPurify** sanitizes all imported HTML and AI output rendered as
  HTML (Phase G).
- **CSP headers** set via Vercel `vercel.json`:
  ```
  Content-Security-Policy: default-src 'self';
    script-src 'self' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com;
    connect-src 'self' https://generativelanguage.googleapis.com https://api.perplexity.ai ...;
    img-src 'self' data: blob:;
  ```
- **Encrypted sync** (Phase U) wraps the sync envelope with libsodium
  using a user passphrase.
- API keys stored in IDB never leave the device except through Drive
  sync (encrypted in Phase U).

---

## Legacy single-file architecture (pre-Phase-G)

For reference, the pre-Phase-G shape was:

- One `index.html` (~26 000 lines) containing:
  - HTML markup (~600 lines) for every view, modal, persistent UI
  - CSS (~6 500 lines) for themes, modals, components
  - JavaScript (~19 000 lines) covering everything from IndexedDB to
    the audio player to quiz modes
- Search the file for `==================== NAME ====================`
  banners to navigate between sections (40+ banners listed in the
  pre-merger version of this doc).
- Module-level `let` globals for state (`currentBookId`, `currentMode`,
  `pendingChapters`, `batchImportQueue`, etc.).

Phase G's migration plan:
1. Extract pure functions to `src/lib/` first (parseFeedJson, markdown
   renderer, sanitizer, etc.) with full unit tests.
2. Extract IDB layer to `src/data/` with Dexie wrapper.
3. Extract one mode at a time to `src/pillars/library/modes/<mode>/`.
4. Last: extract the persistent player and global state.

The legacy `index.html` is preserved on a `legacy-singlefile` branch for
reference.

---

## Continue reading

- Data model (post-Phase-I `sources` + new stores): [`03-data-model.md`](03-data-model.md)
- Provider plugin contracts: [`16-ai-providers.md`](16-ai-providers.md)
- Streaming protocol: [`33-streaming-ai-and-ndjson.md`](33-streaming-ai-and-ndjson.md)
- Phase G rebuild plan: see `implementation-plan/phase-g-architectural-rebuild.md`
