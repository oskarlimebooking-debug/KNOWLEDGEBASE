# Phase A — Foundation

> **Tagline:** A working library and reader with no AI dependencies.

## Goal

Ship a static-hosted PWA where the user can add EPUB / PDF books and
read them as plain chapters, with progress tracking and offline support.

## Why this phase / rationale

Every later phase assumes a working library, IndexedDB schema, view
system, and PWA shell. Doing the foundation right means later phases
plug into a stable substrate. AI is intentionally out of scope here —
the app should be *useful* even with no API keys.

## Prerequisites

None. This is the first phase.

## Deliverables

- Static `index.html` (or modular SvelteKit/Vite app — your call)
  hosted on Vercel.
- IndexedDB database with five stores: `books`, `chapters`, `progress`,
  `generated`, `settings`.
- Library view: grid of book cards with cover, title, author.
- Add Book flow: file picker → extract text → split chapters → save.
- Book detail view: chapter list with completion checkboxes.
- Chapter view: scrolling plain-text reader.
- Mark-as-complete button per chapter.
- Streak counter (consecutive days with at least one chapter completed).
- Daily card on the library home: "Today's chapter".
- Settings modal with theme info + export-data button.
- Service worker that caches the shell + offline fallback.
- PWA manifest with installable icon.

## Task breakdown

### A1 — Project skeleton

- Repo with `index.html`, `manifest.json`, `sw.js`, `package.json`.
- `vercel.json` (or default Vercel detection).
- README with one-liner deploy steps.
- Optional bundler scaffold (Vite + TS) if going modular from day 1.

### A2 — IndexedDB layer

- Open DB `ChapterWiseDB` v1.
- Five object stores keyed by `id`. Add indices:
  - `books.addedAt`
  - `chapters.bookId`
  - `progress.bookId`, `progress.date`
  - `generated.chapterId`
- Wrappers: `dbPut`, `dbGet`, `dbGetAll`, `dbGetByIndex`, `dbDelete`.
- Settings helpers: `getSetting(key)`, `setSetting(key, value)`.
- Schema docs in code comments.

### A3 — UI shell

- Single `<div class="app">` with four view classes: `view-library`,
  `view-book`, `view-chapter`, `view-modal-stack`.
- `setView(name)` toggles modifier classes; CSS shows the right child.
- Header with back button, app title, settings gear.
- Toast component (`showToast(msg, kind)`).
- Loading spinner component.
- Mobile-first responsive grid.

### A4 — Add Book flow

- Big "+ Add Book" button on library.
- File input accepting `.pdf,.epub`.
- For PDFs: PDF.js text extraction (worker from cdnjs).
  - Reconstruct lines from transform matrix.
  - Detect paragraph breaks using line-height heuristic.
  - Detect bullet items.
- For EPUBs: JSZip + parse `META-INF/container.xml` → OPF → HTML files
  → strip tags.
- Auto-extract title from first non-empty line of page 1 (PDFs) or
  `<dc:title>` (EPUBs).
- Plain word-count chapter splitter (default 2000 words / chapter).
- Cover thumbnail: render PDF page 1 at 1× onto a 300×400 canvas, save
  as JPEG data URL. EPUB fallback: emoji cover from a title-keyword
  lookup.
- Save book + chapters to IDB.

### A5 — Library view

- Grid of book cards (cover, title, author, progress %).
- Click → `setView('book')` and render chapter list.
- Empty state: friendly message + "Add your first book".
- Daily card at top: today's suggested chapter (next incomplete chapter
  in the most recently opened book).
- Streak counter chip (calculated from `progress.date` distinct values).

### A6 — Book detail view

- Title, author, cover.
- "X / Y chapters complete" progress bar.
- Chapter list: title + completion check + click handler.
- Delete book button (with confirmation dialog).

### A7 — Chapter view (Read mode only)

- Header: chapter title.
- Body: `chapter.content` rendered as paragraphs, no markdown yet.
- Mark Complete button at the bottom.
- Previous / Next chapter navigation.

### A8 — Settings modal

- Open / close via gear icon.
- Tabs (or sections): Reading, Data.
- Reading: reading speed (wpm) input, font size info.
- Data: Export All Data button (downloads a JSON of every IDB row).

### A9 — PWA + Service Worker

- `manifest.json` with name, short_name, theme_color, background_color,
  start_url, display: standalone, single SVG icon.
- Service worker:
  - Cache name with version (`headway-v1`).
  - Pre-cache `/`, `/index.html`, `/manifest.json`, fonts.
  - Cache-first for static assets, network-first for HTML pages.
  - Offline fallback: serve `/index.html` for navigation requests.
  - **No** `skipWaiting` / `clients.claim` — manual updates only.
- Page-side: register SW, listen for `updatefound`, expose
  `Apply Update` button when waiting worker is installed.

### A10 — Offline behavior

- Library, book detail, chapter view, mark-complete, streak counter,
  export-data: all must work offline once a book is in IDB.
- Show an offline banner when navigator.onLine flips false (optional).

## Acceptance criteria

- [ ] User can add an EPUB or PDF and immediately read it offline.
- [ ] Refresh persists everything (books, chapters, progress).
- [ ] Streak increments when the user completes a chapter on a new day.
- [ ] App is installable on Chrome desktop, Safari iOS, and Android.
- [ ] Lighthouse PWA score ≥ 90.
- [ ] No console errors in normal flows.
- [ ] Export-data round-trips cleanly: import the exported JSON into a
      blank profile and the library is identical.

## Effort estimate

- **T-shirt:** M
- **Person-weeks (small team of 2):** 2–3
- **Critical path:** PDF.js text extraction + IDB schema design.

## Risks & unknowns

- **PDF.js text reconstruction** is fiddly — column-heavy PDFs may
  produce out-of-order text. Acceptable for Phase A; AI-OCR fixes it
  in Phase I.
- **iOS Safari quirks** with file inputs and IDB transactions. Test
  early on a real device.
- **Cover generation memory** — large PDFs can OOM the canvas render.
  Cap at 5 MB for cover-only and skip for larger.
- **Service worker mistakes** can brick the app. Use a feature flag in
  the URL (`?nosw=1`) that bypasses registration during development.

## Out of scope

- Any AI feature (Phases B onward).
- TTS (Phase E).
- Cloud sync (Phase F).
- Markdown rendering, chapter editor, OCR (later phases).
- Multiple themes, accessibility polish (Phase N).

## Decision points before Phase B

- [ ] Confirm IDB schema keys are stable. Renaming after Phase B is
      painful; this is the moment to lock the IDs.
- [ ] Decide on the chapter-ID format
      (`<bookId>_ch_<index>` is the legacy choice).
- [ ] Decide whether to split `pdfData` into a separate store now (less
      heap pressure in Phase F sync), or postpone to Phase M.

---

Continue to [Phase B — AI Core & Basic Learning](phase-b-ai-core.md).
