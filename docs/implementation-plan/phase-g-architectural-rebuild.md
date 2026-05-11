# Phase M — Architectural Modernization

> **Tagline:** From one HTML file to a real codebase, without breaking anything.

## Goal

Migrate the single-file PWA into a proper modular codebase: TypeScript
strict mode, Vite bundler, feature-based folders, Web Worker offload,
OPFS-backed PDF storage, Dexie-typed IDB, and a real test suite.
Crucially: **without** reducing user-facing functionality and without
forcing users to re-import their library.

## Why this phase / rationale

The single-file architecture was a great forcing function in Phases
A–L. By Phase L the file is tens of thousands of lines, dozens of
mutable globals, and zero tests. New contributors take days to ramp.
Bug fixes in one mode regress another. iOS memory limits are hit
because PDFs live in IDB heap.

This phase pays the technical debt accumulated across L phases. The
output is a codebase that future phases (N–R) can build on without
fear.

This is also the right moment to add tests, error tracking, and CI
gates — features that are too painful to bolt onto the monolith.

## Prerequisites

- Phases A–L (everything user-facing must be done; the rebuild is
  pure refactor).

## Deliverables

- TypeScript strict mode end-to-end.
- Vite bundler with code-splitting per route.
- Feature-based folder layout (`src/modes/quiz/`, `src/providers/ai/`,
  etc.).
- Plugin contracts for AI / TTS / image / video / sync providers.
- Dexie-typed IDB schema with migrations.
- OPFS-backed PDF binary storage (out of IDB heap).
- Web Worker offload for OCR, chapter detection, and search.
- `Comlink`-based worker boundaries.
- `parseFeedJson`, `mergeArrayById`, `splitTextIntoChunks`, and other
  pure helpers extracted and unit-tested with Vitest.
- Playwright e2e tests on three fixture books.
- DOMPurify replaces in-house sanitizer.
- Bundle size budgets enforced in CI.
- Sentry-compatible opt-in error reporting.
- One-shot migration that converts v1 IDB schema to v2 OPFS-backed
  schema transparently.

## Task breakdown

### M1 — Tooling and CI setup

- `pnpm` workspace.
- `vite` + `vite-plugin-pwa`.
- `tsconfig.json` strict mode.
- `eslint` + `prettier`.
- GitHub Actions:
  - Lint + format check on PRs.
  - Vitest run on PRs.
  - Playwright run on PRs.
  - Lighthouse budget check.
  - Vercel preview deploy.

### M2 — Folder structure

(See `docs/25-rebuild-blueprint.md` for the exhaustive layout. The
abbreviated tree:)

```
src/
├── app/                  # routes
├── modes/                # one folder per reading mode
├── providers/            # AI, TTS, image, video, sync plugins
├── pipeline/             # extract / OCR / chapter detect / clean
├── data/                 # Dexie + repos + zod schema
├── ui/                   # design system + player + PDF viewer
├── workers/              # PDF, OCR, search, crypto
├── lib/                  # prompts, markdown, ids, utilities
└── api/                  # Vercel edge functions
```

### M3 — TypeScript types

Schema as zod schemas (runtime + type):

```ts
import { z } from 'zod';

export const Book = z.object({
  id: z.string().uuid(),
  title: z.string(),
  author: z.string().optional(),
  // ...
});
export type Book = z.infer<typeof Book>;
```

Same for `Chapter`, `Progress`, `Generated`, `Settings`.

### M4 — Dexie migration

```ts
class HeadwayDB extends Dexie {
  books!: Table<Book>;
  chapters!: Table<Chapter>;
  progress!: Table<Progress>;
  generated!: Table<Generated>;
  settings!: Table<{ key: string; value: any }>;

  constructor() {
    super('ChapterWiseDB');
    this.version(1).stores({
      books: 'id, addedAt',
      chapters: 'id, bookId',
      progress: 'id, bookId, date',
      generated: 'id, chapterId',
      settings: 'key'
    });

    this.version(2).upgrade(async (tx) => {
      // Move pdfData from books to OPFS
      const books = await tx.table('books').toArray();
      for (const book of books) {
        if (book.pdfData instanceof ArrayBuffer) {
          await opfs.write(`books/${book.id}/source.pdf`, book.pdfData);
          book.pdfRef = `books/${book.id}/source.pdf`;
          delete book.pdfData;
          await tx.table('books').put(book);
        }
      }
    });
  }
}
```

### M5 — OPFS module

```ts
// src/data/opfs.ts
export const opfs = {
  async write(path: string, data: ArrayBuffer | Blob) { ... },
  async read(path: string): Promise<ArrayBuffer> { ... },
  async delete(path: string) { ... },
  async exists(path: string): Promise<boolean> { ... },
};
```

OPFS is supported on all modern browsers including iOS Safari 15.2+.
For older browsers, fall back to IDB blob storage.

### M6 — Provider plugin contracts

```ts
// src/providers/ai/index.ts
export interface CallAIPlugin {
  id: string;
  displayName: string;
  isConfigured(): Promise<boolean>;
  ensureAuth(): Promise<void>;
  call(args: {
    prompt: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    jsonMode?: boolean;
    images?: { mimeType: string; data: ArrayBuffer }[];
    onToken?: (token: string) => void;
    signal?: AbortSignal;
  }): Promise<string>;
  listModels?(): Promise<{ id: string; name: string }[]>;
}
```

Implementations: `gemini.ts`, `merlin.ts`, `junia.ts`, `docanalyzer.ts`.

A registry exposes:
```ts
export const aiProviders: Record<string, CallAIPlugin> = {
  gemini: new GeminiProvider(),
  merlin: new MerlinProvider(),
  // ...
};

export async function callAI(args) {
  const id = await getSetting('aiProvider') || 'gemini';
  return aiProviders[id].call(args);
}
```

Same pattern for TTS, image, video, sync providers.

### M7 — Web Workers via Comlink

```ts
// src/workers/pdf.worker.ts
import * as Comlink from 'comlink';
import * as pdfjs from 'pdfjs-dist';

const api = {
  async extractText(buffer: ArrayBuffer) { ... },
  async render(buffer: ArrayBuffer, pageNum: number, scale: number) { ... },
};

Comlink.expose(api);
```

```ts
// main thread
const worker = new Worker('/workers/pdf.worker.js', { type: 'module' });
const pdf = Comlink.wrap<typeof api>(worker);
const text = await pdf.extractText(buffer);
```

Workers to extract:
- `pdf.worker.ts` — text extraction + render
- `ocr.worker.ts` — Tesseract WASM (Phase P) + AI-OCR orchestration
- `chapter-detect.worker.ts` — chunk-based detection
- `search.worker.ts` — full-text search index (Phase N)
- `crypto.worker.ts` — encryption (Phase O)

### M8 — Markdown + sanitization

Replace the in-house `formatContent` / `sanitizeHtml` with `marked` +
DOMPurify:

```ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text));
}
```

DOMPurify catches edge cases the in-house sanitizer misses.

### M9 — Pure helper extraction & tests

Move to `src/lib/`:
- `parse-feed-json.ts` (with the 5-strategy fallback).
- `merge-array-by-id.ts`.
- `split-text-into-chunks.ts`.
- `format-number.ts`.
- `format-time.ts`.
- `time-ago.ts`.
- `array-buffer-base64.ts`.

Each gets a `*.test.ts` file with Vitest covering edge cases. Goal:
≥ 80% line coverage on `lib/`.

### M10 — Playwright e2e tests

Three fixture books in `tests/fixtures/`:
- `simple-novel.epub` — clean text, simple chapter detection.
- `scanned-paper.pdf` — needs OCR.
- `multi-column-textbook.pdf` — exercises text reconstruction.

Tests:
- Library: import → see book → open chapter → read.
- Quiz: open chapter → quiz tab → answer 3 questions → see score.
- Listen: open chapter → listen → play → pause.
- Sync (mocked): connect Drive → upload → download to a fresh
  profile → library matches.
- PDF viewer: open → highlight → save annotated PDF.

Snapshot tests for the markdown renderer + JSON parser.

### M11 — Bundle splitting

Vite does this automatically per route. Verify with `npm run build`:
- Library route ≤ 150 KB gzipped.
- PDF viewer ≤ 300 KB additional (PDF.js loaded only here).
- Listen route ≤ 150 KB additional.
- Settings ≤ 100 KB additional.

CI gate: fail the PR if any budget is exceeded.

### M12 — Service worker upgrade

Use `vite-plugin-pwa`'s Workbox-generated SW with:
- Auto-versioning from build hash.
- Same API allowlist as before.
- Manual update dialog (no skipWaiting).

### M13 — Sentry-compatible error logging

```ts
// src/lib/telemetry.ts
const errors: Error[] = [];

export function logError(e: Error, context?: object) {
  errors.push(e);
  db.errors.add({
    message: e.message, stack: e.stack, context,
    ts: new Date().toISOString(),
    appVersion: __APP_VERSION__
  });
  if (sentry?.dsn) sentry.captureException(e, { extra: context });
}
```

Settings: optional Sentry DSN (default off — local logs only).
"Diagnostics" page in Settings shows the local error log + DB stats
+ memory usage estimate.

### M14 — Migration UX

A user opening the new app for the first time:
1. Detect v1 IDB schema.
2. Show a "Upgrading your library…" splash.
3. Run the v2 migration (move PDFs to OPFS, normalize types).
4. Show "Done" and reload.

Test on a profile imported via the Phase A app to confirm no data
loss.

### M15 — Documentation

Migrate `docs/01-overview.md` etc. to reflect the new layout. Each
phase doc can stay valid because they describe **what**, not the
file structure.

### M16 — Performance targets

After the rebuild:
- Cold load on slow 3G iPhone: ≤ 3s TTI.
- Library route bundle: ≤ 150 KB gzipped.
- Memory headroom: a 200 MB library uses ≤ 200 MB main thread peak.
- PDF viewer can render a 600-page textbook without OOM.

## Acceptance criteria

- [ ] All Phase A–L features still work identically.
- [ ] No user has to re-import their library.
- [ ] Vitest passes with ≥ 80% coverage on `lib/`.
- [ ] Playwright e2e suite green.
- [ ] Bundle budgets enforced in CI.
- [ ] Lighthouse PWA score ≥ 95 (was 90 baseline).
- [ ] Memory usage measurably lower (capture before/after with
      Chrome DevTools Performance Monitor).
- [ ] Cold load measurably faster (Lighthouse TTI).
- [ ] OPFS migration runs once and never again.
- [ ] Sentry error reporting opt-in works.

## Effort estimate

- **T-shirt:** XL
- **Person-weeks:** 8–12
- **Critical path:** OPFS migration (data integrity is non-negotiable)
  + Web Worker boundaries (every async call site needs revisiting).

## Risks & unknowns

- **Migration data loss** is the only unrecoverable risk. Build the
  migration with a backup-first strategy: copy the entire v1 IDB to
  a v1-backup database before mutating.
- **OPFS browser support** — older Safari versions fall back to IDB
  blobs, which is acceptable but means some users get the heap
  pressure benefit and some don't.
- **Worker overhead** for tiny operations isn't worth it. Keep
  workers for bulk operations only (OCR, chapter detect, search).
- **TypeScript migration** can drag if done all-at-once. Recommend
  module-by-module starting with `lib/` and `data/`, then providers,
  then UI last.
- **Dexie can be slower than raw IDB** for some operation patterns.
  Profile any hot path.

## Out of scope

- New user-facing features (those go in Phase N+).
- Non-essential refactors that don't pay for themselves.
- Native apps (Phase R).

## Decision points before Phase N

- [ ] Confirm framework (SvelteKit / Next / Solid Start) before
      committing weeks of work.
- [ ] Decide whether to migrate prompts to `lib/prompts/<key>.md` files
      (recommended yes — easier to diff and review).
- [ ] Decide whether DOMPurify replaces the in-house sanitizer fully
      or coexists.
- [ ] Decide whether Sentry is opt-in (recommended) or always-off.

---

Continue to [Phase N — Quality of Life](phase-n-quality-of-life.md).
