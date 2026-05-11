# Phase M — Advanced Import and OCR + URL/DOI Ingestion

> **Tagline:** Bulk import, AI-OCR, URL/DOI ingestion, and the cowork import format.

## Goal

Replace the simple Phase A "Add Source" flow with a powerful import
pipeline: a multi-file batch queue, AI-driven OCR for scanned PDFs,
intelligent chapter detection, **article URL ingestion**, **DOI lookup**,
**OpenAlex enrichment**, and the full `chapterwise-import.json` package
format that lets external tools (and the Claude pipeline skill) hand-
deliver pre-cooked libraries.

## Why this phase / rationale

Phase A's importer works for a single tidy EPUB. Real users have
folders of scanned papers, badly OCRed scans, multi-column textbooks,
and bibliographies they want to delete. AI-OCR is the practical answer
— but it requires a careful page-by-page review flow so the user
trusts what's going into their library.

Post-merger, Phase M also adds article-specific ingestion paths:
- Paste a URL → server-side fetch + readability extraction
- Paste a DOI → CrossRef lookup + author/journal enrichment
- Discovery results auto-flow through this same pipeline

The import package format also unlocks **bulk pipelines** outside the
browser. Phase N (PDF viewer) needs cleanly imported PDFs; Phase S
(Cross-source intelligence) benefits from large libraries.

## Prerequisites

- Phases A–G (foundation + rebuild).
- Phase I (Source Generalization) — `kind: 'article'`/`'url'` exist.
- Phase K specifically: AI-OCR uses Gemini or Merlin's image endpoint;
  URL ingestion uses the unified `callAI` for content extraction.

## Deliverables

- **Batch import queue** with per-file status, retry, and a corner badge.
- **AI-OCR pipeline** with Gemini or Merlin (page-by-page).
- **OCR review modal** to accept / edit / re-OCR / skip per page.
- **Chapter detection cascade**:
  1. `/chapter/` markers parser.
  2. Pattern detection (Chapter X, Part X, etc.).
  3. AI sequential detection with chunk overlap and fuzzy match.
  4. AI-refined word-count split.
  5. Plain word-count fallback.
- **Chapter review modal** for editing before commit.
- **Manual chapter editor** (text area + insert markers).
- **Resplit chapters** flow on existing books.
- **Import package** format `chapterwise-import.json`.
- **Local auto-detect import banner** on app load.
- **File picker import** (Settings → Import JSON).
- **Paste JSON import** (Settings → Paste JSON).
- **Background processing banner** with resume.
- **Title prediction** when extraction can't find one.
- **NEW: Article URL ingestion** — paste a URL, fetch via Vercel proxy,
  apply Readability.js / Mozilla Readability extraction, store as
  `kind: 'url'` Source.
- **NEW: DOI lookup** — paste a DOI or detect one in metadata, query
  CrossRef via `/api/lookup/doi.ts`, populate authors / journal /
  volume / pages / year on the Source.
- **NEW: OpenAlex enrichment** — fetch related metadata (concepts,
  citation count, references) from OpenAlex via
  `/api/lookup/openalex.ts`. Used to seed `concepts[]` and to build
  Phase W's research graph.
- **NEW: Project JSON import** flow — extension of `importFromPackage`
  that handles the `projects` and `project_sections` arrays (delivered
  in Phase H, refined here).
- **NEW: arxiv.org / sci-hub fallback** for PDF retrieval when the
  user pastes a DOI without a free PDF link from CrossRef.

## Task breakdown

### I1 — Batch import queue

Replace single-file "Add Book" with a queue panel. Each queue item:
```js
{
  id: 'batch_<ts>_<rand>',
  file: File,
  fileName, isPDF,
  status: 'pending'|'extracting'|'processing'|'ready'|'done'|'error',
  text, title, chapters, bookData, pdfFileRef,
  fullText, progressText, error
}
```

UI:
- Floating badge (bottom-right) with active item count.
- Click to open the queue panel.
- Per-row: spinner / status icon / Review button when ready.
- "Add More" button.
- Failed items get a Retry button.

`processBatchQueue()` runs sequentially (not in parallel) to keep
quotas calm and memory bounded.

### I2 — OCR options modal

Before queueing, ask:
- **OCR provider**: None (PDF.js text only) / Merlin AI / Gemini API.
- **OCR mode** (Merlin only): text or image.
- **OCR add-ons** (when OCR is on): chapter markers, remove citations,
  describe tables.
- **Chapter detection**: AI auto / word-count split / no split / manual.
- **Word-count target**: default 3000.

Save into a global `batchOcrSettings` object applied to every file.

### I3 — AI-OCR via Gemini

`extractPDFWithAI(file, apiKey, onProgress, modelOverride, ocrOptions)`:

For each page:
1. Render via PDF.js at 2× scale onto canvas.
2. `canvas.toDataURL('image/jpeg', 0.85)` → base64.
3. Build a body-text-only prompt with optional add-ons:
   - Chapter markers: insert `/chapter/` lines.
   - Remove citations: drop `[1]`, `(Smith et al., 2020)`, etc.
   - Describe tables: convert to natural-language descriptions.
4. Include continuity context: the last 40 words of the previous page.
5. POST to Gemini's `generateContent` endpoint with the image inline.
6. If `finishReason === 'MAX_TOKENS'`, retry once with higher limit.
7. If extraction failed, fall back to PDF.js text for that page.
8. Push the page result + the rendered image into `pagesForReview`.

Progress reporting: `onProgress(pageNum, totalPages)`.

### I4 — AI-OCR via Merlin

`extractPDFWithMerlin(file, onProgress, ocrOptions)`:
- Same flow as Gemini, but uses `callMerlinAPIWithImage`.
- Two modes: `text` (cheaper) and `image`.

### I5 — OCR review modal

After extraction, before commit:
- Thumbnail of each page (the rendered JPEG).
- Editable textarea with the extracted text.
- "Re-OCR this page" button (re-fires the prompt).
- "Skip page" (drops content for that page).
- "Accept" → next page.
- Final "Commit" → returns the concatenated text.

The flow returns a Promise (`ocrReviewResolve`) that resolves when
the user finishes the last page.

### I6 — Chapter detection cascade

`splitIntoChapters(text, bookTitle, apiKey, modelOverride, useSequential)`:

1. `splitByChapterMarkers(text)` — handles `/chapter/` markers.
2. `detectChapterPatterns(text)` — regex for Chapter X / Part X /
   Section X / numeric headings.
3. `aiBasedChapterDetection(text, ...)` — single-pass for short, or
   sequential (25k char chunks with 3k overlap) for long.
4. If everything fails, `splitByWordCount(text)` (Phase A's fallback).

Outer 3-minute hard timeout on the whole detection.

### I7 — Sequential chapter detection details

For long texts:
- Walk the text in 25k char chunks with 3k overlap.
- For each chunk, ask the AI for `[{position, title, firstWords}]`.
- `mergeBoundaries` dedupes within ±500 chars; verifies each by
  searching for `firstWords` in the source (4 fuzzy strategies).
- `buildChaptersFromBoundaries` slices text between adjacent
  positions; drops chapters < 100 chars.

If text coverage < 80%, append a "Continuation" chapter for the
trailing text.

### I8 — Smart word-count split

`splitByWordCountWithAI(text, bookTitle, target, apiKey)`:
1. Compute rough cut points every `target` words.
2. For each, extract ±20 lines of context.
3. Send all contexts in a single batch request: "for each, find the
   best natural break and a chapter title".
4. Parse the JSON, find each suggested break line, build chapters
   between them.

Falls back to plain word count on parse failure.

### I9 — Chapter review modal (post-detection editor)

Pre-commit editor:
- List of chapters with click-to-edit.
- Edit content (separate textarea modal).
- Edit title inline.
- Split chapter at cursor.
- Merge with previous.
- Delete chapter.
- Add new chapter after current.
- Auto-renumber.
- Re-split with word count (in-place).
- Re-analyze (re-run `splitIntoChapters`).
- Confirm → write to IDB.

### I10 — Manual chapter editor

For users who want full control:
- Big textarea with the whole book text.
- "Insert Marker" button at cursor.
- "Auto-detect markers" button (AI inserts `<<<CHAPTER>>>`).
- Preview button (shows resulting chapters).
- Confirm.

`splitByManualMarkers(text)` parses `<<<CHAPTER|Optional Title>>>`.

### I11 — Resplit existing books

Available from book detail. Modal:
- Choose mode (auto / wordcount / manual).
- Confirm warning: existing chapters and their generated cache will
  be deleted, since chapter IDs change.
- Re-run `splitIntoChapters` and write fresh.

### I12 — Title prediction

`predictDocumentTitle(text, fileName)`:
- AI prompt with first ~3000 chars asking for a single best title.
- Falls back to file name (sans extension, smart-cased) on failure.

### I13 — Cover generation in import

After commit:
- Render PDF page 1 onto a 300×400 canvas at 1×.
- Save as JPEG data URL in `book.coverImage`.
- EPUBs: emoji cover via `getBookEmoji(title)`.

### I14 — Import package format

```jsonc
{
  "version": 1,
  "syncedAt": "<ISO>",
  "books": [...],          // pdfData base64 with _pdfDataIsBase64
  "chapters": [...],
  "progress": [...],
  "generated": [...],      // optional pre-baked AI output
  "settings": {...}
}
```

`importFromPackage(syncData)`:
- Validate `books` and `chapters` arrays.
- `importSyncDataIncremental(syncData)` (one book at a time, base64
  inflation, settings sync).
- Generate covers for books without them.
- `loadLibrary()` to refresh.

Idempotent — re-importing the same package is safe.

### I15 — Auto-detect local import

`init()` calls `checkForLocalImport()`:
- `fetch('./chapterwise-import.json', { cache: 'no-store' })`.
- If valid, show a green banner with counts.
- Click "Import" → `acceptLocalImport()`.

Service worker passes through `chapterwise-import.json` so the file
is always re-fetched.

### I16 — File picker / paste import

Settings additions:
- Import JSON File button → file picker → `JSON.parse` → import.
- Paste JSON button → modal with textarea → `JSON.parse` → import.
- Max file size: 200 MB.

### I17 — Background processing

For very long books:
- "Process in background" checkbox in the OCR options modal.
- `processBookInBackground(options)` runs the same pipeline but yields
  control between chunks.
- Top banner shows progress: "Processing 'Title'… 45 / 320 pages".
- Persist progress to a `pending_<bookId>` row; resume on reload.
- "Review" button on the banner opens the chapter review modal when
  ready.

### I18 — `.gitignore`

Add `chapterwise-import.json` (the file is intended to be transient).

## Acceptance criteria

- [ ] User can drop 5 PDFs at once, all process sequentially.
- [ ] Failed item retries cleanly.
- [ ] AI-OCR produces noticeably better text than PDF.js on a scanned
      paper.
- [ ] OCR review lets the user fix at least one page and the edit
      survives.
- [ ] All four chapter detection strategies work on appropriate
      fixtures.
- [ ] `/chapter/` markers split correctly with inline titles.
- [ ] Background processing survives a tab reload.
- [ ] `chapterwise-import.json` auto-detected and imported on a fresh
      profile.
- [ ] Re-importing the same package doesn't duplicate data.

## Effort estimate

- **T-shirt:** L
- **Person-weeks:** 4–6
- **Critical path:** AI-OCR per-page review + sequential chapter
  detection.

## Risks & unknowns

- **AI-OCR latency** — 2–4s/page × 300 pages = 15+ minutes. The
  background processing flow makes this tolerable.
- **Page render OOM** at 2× scale for large pages. Cap at 1.5× as a
  fallback.
- **Chapter detection accuracy** is highly variable. Always provide
  a manual mode escape hatch.
- **Import file size** — 200 MB cap may not be enough for
  novel-collection imports. Extend to 500 MB if needed (and drop
  pdfData via `_pdfDataExcluded`).

## Out of scope

- Tesseract WASM local OCR (Phase P).
- URL/web article import (Phase N).
- DOCX / MOBI / TXT support (Phase N).
- Audiobook MP3 import via Whisper (Phase P).
- Concurrent page extraction (Phase M).

## Decision points before Phase J

- [ ] Confirm import package format is final. Drive sync uses the same
      shape; breaking it requires a migration.
- [ ] Decide whether OCR review is mandatory or optional. (Recommend
      optional with a "skip review" checkbox.)

---

Continue to [Phase J — PDF Viewer](phase-j-pdf-viewer.md).
