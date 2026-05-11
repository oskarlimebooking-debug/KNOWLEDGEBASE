# Sprint A: Foundation — Library, IDB, PWA shell

> One task per T-item in `docs/implementation-plan/phase-a-foundation.md`.
> No AI in this sprint. Output: a static-hosted PWA with offline library + chapter reader.

### Phase 1: Scaffolding

### TA.1 -- Project skeleton (Vite + TS + PWA scaffold) | Cx: 5 | P0

**Description:** Create the repo skeleton: `index.html`, `manifest.json`, `sw.js`, `package.json`, optional `vite` + TypeScript bootstrap, `vercel.json`. Ship a deployable hello-world to Vercel.

**AC:**
- [ ] `pnpm install && pnpm dev` boots a working app at `localhost`
- [ ] `vercel.json` (or auto-detection) deploys cleanly on push
- [ ] README documents the one-liner deploy
- [ ] TS strict mode on if going modular from day one
- [ ] Lighthouse PWA precheck score ≥ 50 (full target hit later)

**Depends on:** None

### TA.2 -- IndexedDB schema + wrappers | Cx: 8 | P0

**Description:** Open DB `ChapterWiseDB` v1 with five stores: `books`, `chapters`, `progress`, `generated`, `settings`. Indices on `books.addedAt`, `chapters.bookId`, `progress.bookId`+`progress.date`, `generated.chapterId`. Wrappers: `dbPut`, `dbGet`, `dbGetAll`, `dbGetByIndex`, `dbDelete`. Settings helpers `getSetting(key)` / `setSetting(key, value)`. Schema docs in code comments.

**AC:**
- [ ] DB opens on first run and on refresh
- [ ] All five stores exist with the documented indices
- [ ] Wrappers covered by Vitest unit tests (≥ 90% branch coverage)
- [ ] Settings round-trip cleanly through `getSetting` / `setSetting`
- [ ] No console errors on hot reload

**Depends on:** TA.1

### Phase 2: UI shell + library

### TA.3 -- App shell + view system | Cx: 5 | P0

**Description:** Single `<div class="app">` with view classes `view-library`, `view-book`, `view-chapter`, `view-modal-stack`. `setView(name)` toggles modifier classes; CSS shows the right child. Header with back button, app title, settings gear. `showToast(msg, kind)` component. Loading spinner component. Mobile-first responsive grid.

**AC:**
- [ ] `setView('library' | 'book' | 'chapter')` swaps content with no flicker
- [ ] Header responds to back-button taps on every non-root view
- [ ] Toast renders 4 kinds (info / success / warn / error) and auto-dismisses
- [ ] Layout reflows correctly at 320px, 768px, 1280px widths
- [ ] No CLS issues per Lighthouse

**Depends on:** TA.1

### TA.4 -- Add Book flow (PDF + EPUB) | Cx: 13 | P0

**Description:** Big "+ Add Book" button, file input accepting `.pdf,.epub`. PDFs: PDF.js text extraction (worker from cdnjs), reconstruct lines from transform matrix, detect paragraph breaks via line-height, detect bullets. EPUBs: JSZip + parse `META-INF/container.xml` → OPF → HTML → strip tags. Auto-extract title from page 1 (PDF) or `<dc:title>` (EPUB). Plain word-count chapter splitter (default 2000 w/ch). Cover thumb (300×400 canvas) JPEG data URL; EPUB fallback to emoji-from-keyword. Save book + chapters to IDB.

**AC:**
- [ ] EPUB import: 3-fixture EPUBs (novel / textbook / mixed) all open with title + chapters
- [ ] PDF import: 3-fixture PDFs (text-only / scanned-text / column-heavy) extract text and chapter-split
- [ ] PDFs > 5 MB skip cover generation gracefully (no OOM)
- [ ] Save commits all rows in a single IDB transaction; partial failure rolls back
- [ ] Manual test passes on iOS Safari with one EPUB

**Depends on:** TA.2, TA.3

### TA.5 -- Library grid view | Cx: 5 | P1

**Description:** Grid of book cards (cover, title, author, progress %). Click → `setView('book')` and render chapter list. Empty state with "Add your first book". Daily card at top showing today's suggested chapter (next incomplete chapter in most recently opened book). Streak counter chip from `progress.date` distinct values.

**AC:**
- [ ] Library renders ≤ 100ms for a 50-book library on a baseline laptop
- [ ] Empty state shows when library is empty
- [ ] Daily card surfaces the correct chapter (verify with two-book fixture)
- [ ] Streak counter increments correctly across midnight boundary (manual test or mocked clock)

**Depends on:** TA.3, TA.4

### TA.6 -- Book detail view | Cx: 5 | P1

**Description:** Title, author, cover. "X / Y chapters complete" progress bar. Chapter list with title + completion check + click handler. Delete book button with confirmation dialog.

**AC:**
- [ ] Progress bar reflects IDB state on first render
- [ ] Delete book cascades: book + chapters + progress + generated rows all removed
- [ ] Confirmation dialog blocks accidental deletion (Escape cancels)
- [ ] Cover renders or falls back to placeholder

**Depends on:** TA.5

### TA.7 -- Chapter view (Read mode only) | Cx: 5 | P1

**Description:** Header with chapter title. Body: `chapter.content` as paragraphs (no markdown yet). Mark Complete button at bottom. Previous/Next chapter navigation.

**AC:**
- [ ] Paragraph rendering preserves blank lines
- [ ] Mark Complete writes a `progress` row and updates the button to "Completed"
- [ ] Prev / Next disabled at boundaries
- [ ] No layout shift after mark-complete

**Depends on:** TA.6

### Phase 3: PWA + offline

### TA.8 -- Settings modal | Cx: 3 | P1

**Description:** Open / close via gear icon. Tabs (or sections): Reading, Data. Reading: reading speed (wpm) input, font size info. Data: Export All Data button (downloads a JSON of every IDB row).

**AC:**
- [ ] Settings open/close from the header gear
- [ ] WPM input persists and validates (numeric, 50–1000)
- [ ] Export All Data round-trips: import the resulting JSON into a blank profile and the library is identical
- [ ] No console errors

**Depends on:** TA.2, TA.3

### TA.9 -- PWA manifest + service worker | Cx: 8 | P0

**Description:** `manifest.json` with name, short_name, theme_color, background_color, start_url, display: standalone, single SVG icon. Service worker: cache name with version (`headway-v1`), pre-cache `/`, `/index.html`, `/manifest.json`, fonts, cache-first for static assets, network-first for HTML, offline fallback. **No** `skipWaiting`/`clients.claim` — manual updates only. Page-side: register SW, listen for `updatefound`, expose Apply Update button.

**AC:**
- [ ] App is installable on Chrome desktop, Safari iOS, and Android (manual verify all three)
- [ ] Lighthouse PWA score ≥ 90
- [ ] `?nosw=1` URL flag bypasses SW registration (dev safety)
- [ ] "Apply Update" button appears when a new SW version is waiting
- [ ] No skipWaiting/claim — verified by reading the SW source

**Depends on:** TA.1, TA.3

### TA.10 -- Offline behavior verification | Cx: 5 | P0

**Description:** Library, book detail, chapter view, mark-complete, streak counter, export-data all work offline once a book is in IDB. Optional offline banner on `navigator.onLine === false`.

**AC:**
- [ ] Playwright e2e: load app, add a book, disable network, navigate library → book → chapter → mark complete → all succeed
- [ ] Streak counter increments correctly while offline
- [ ] Export Data works offline
- [ ] Offline banner (if implemented) appears within 1s of going offline

**Depends on:** TA.9

---

## Sprint enforcement gates (must pass before Sprint B begins)

- [ ] **G-AC** — all task AC ticked in PR description
- [ ] **G-Tests** — `npm test` green; coverage ≥ 86%
- [ ] **G-Arch** — `bpsai-pair arch check src/` clean
- [ ] **G-Lighthouse** — PWA score ≥ 90 on Vercel preview
- [ ] **G-Manual** — IDB schema reviewed; chapter-ID format LOCKED (`<bookId>_ch_<index>` legacy default)
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint B:**

- [ ] Confirm IDB schema keys are stable (renaming after B is painful)
- [ ] Lock chapter-ID format
- [ ] Decide whether to split `pdfData` into a separate store now (less heap in F sync) or postpone to G
