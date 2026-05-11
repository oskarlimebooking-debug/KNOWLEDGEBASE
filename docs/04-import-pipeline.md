# 04 — Import Pipeline

The end-to-end journey from "user drops a file" to "source is in the
library". There are **five** entry points (post-merger):

1. **Single-file dialog** — legacy "Add Source" button.
2. **Batch queue panel** — the modern path; supports many files and a
   processing queue. This is what this document focuses on.
3. **JSON package import** — pre-cooked import file (library or
   project — see [`22-import-file-format.md`](22-import-file-format.md)).
4. **URL ingestion** (Phase M) — paste a URL, fetch via Vercel proxy,
   apply Readability extraction, store as `kind: 'url'` Source.
5. **Discovery → Add to library** (Phase L) — adds an article from
   Discovery results as a `kind: 'article'` Source with auto-DOI
   enrichment via [`/api/lookup/doi`](21-vercel-proxies.md).

For the project-import shortcut (`type: "project"` envelope) see
[`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md).

## Step 0 — User drops files

`handleBatchFileAdd(event)` (`index.html:6793`):

```
event.target.files → Array
addFilesToBatchQueue(files)
```

If the user has not configured **any** AI provider, the function shows a
warning toast and aborts (chapter detection / OCR cleaning are AI-driven).

If any file is a PDF, `showOcrOptionsModal(files, hasPDFs)` opens before
the queue is created. The modal asks:

- **OCR provider**: None (PDF.js text-only) / Merlin AI / Gemini API
- **OCR mode** (Merlin only): text or image
- **OCR processing options** (when OCR is enabled): chapter markers,
  remove citations, describe tables
- **Chapter detection mode**: AI auto / word-count split / no split / manual
- **Word-count target** (when wordcount mode is selected): default 3 000

These choices are saved into a global `batchOcrSettings` object and applied
to every file in the batch.

## Step 1 — Build the queue

`addFilesToBatchQueueInternal(files)` (`index.html:7111`) creates one queue
item per file:

```js
{
  id: 'batch_<ts>_<rand>',
  file: File,                  // browser File handle
  fileName: 'sapiens.pdf',
  status: 'pending',           // pending | extracting | processing | ready | done | error
  text: '',                    // populated after extraction
  title: '',                   // predicted by AI
  isPDF: true,
  error: '',
  chapters: [],                // populated after detection
  bookData: null,
  pdfFileRef: ArrayBuffer,     // raw bytes
  fullText: '',
  progressText: ''             // user-facing status
}
```

The queue is rendered into `#batch-import-list` by `updateBatchImportUI()`
which shows per-row spinner / status icon / Review button when ready.

## Step 2 — Process one item at a time

`processBatchQueue()` (`index.html:7155`) runs sequentially:

```
while there is a pending item:
   pull the next pending item
   item.status = 'extracting'
   if PDF:
     {text, title} = await extractPDFContent(file)   // text-only via PDF.js
   else (EPUB):
     {text, title} = await extractEPUBContent(file)

   item.status = 'processing'
   if user chose AI OCR (gemini):
     processedText = await extractPDFWithAI(file, apiKey, ..., ocrOptions)
   else if Merlin OCR:
     processedText = await extractPDFWithMerlin(file, ..., ocrOptions)
   else:
     processedText = text

   if no extraction title:
     title = await predictDocumentTitle(processedText, fileName)

   if chapter mode = none:
     chapters = [{title, content: processedText}]
   else if chapter mode = wordcount:
     chapters = await splitByWordCountWithAI(processedText, title,
                                             targetWords, apiKey)
   else (auto):
     /chapter/ marker detection → splitByChapterMarkers
     else pattern detection → detectChapterPatterns
     else AI sequential detection → aiBasedChapterDetection
     else fallback → splitByWordCount

   item.chapters = chapters
   item.status = 'ready'      // user must click "Review" to commit
```

A failed item gets `item.status = 'error'` plus `item.error = msg`. The
user can hit a Retry button which resets to `pending`.

## Step 3 — Review modal

When the user clicks **Review** on a "ready" row, `batchImportReview(itemId)`
opens the chapter review modal populated with that item's `chapters` array
and stages it as `pendingBookData` + `pendingChapters`.

The modal supports:
- Edit chapter title inline
- Edit content (pops a separate edit modal with a `<textarea>`)
- Split chapter at the cursor
- Merge chapter into previous
- Delete chapter
- Add new chapter after current
- Re-number chapters automatically
- **Re-split with word count** (in-place)
- **Re-analyze** (re-run AI chapter detection)

When the user clicks **Confirm**:

1. Generate a `book_<ts>` ID, write to `books` store with metadata + PDF
   binary + cover image (auto-generated from PDF page 1).
2. For each chapter, write `<bookId>_ch_<i>` with `index`, `number`,
   `title`, `content`, `text`.
3. Mark the queue item `done`.
4. Reload the library.

## Cover generation

`generateCoverImage(pdfData)` (`index.html:13743`) renders page 1 of the
PDF onto a 300 × 400 canvas at 1× scale, exports as JPEG (`0.85` quality),
returns a `data:` URL stored in `book.coverImage`. EPUBs and other formats
fall back to a generated emoji cover (see `getBookEmoji` mapping).

## Background processing banner

For very long books, the user can opt to send processing into the
background. `processBookInBackground(options)` (`index.html:21200`) runs
the same pipeline but:

- Shows a top banner: "Processing 'Title'… 23 / 45 pages"
- Persists progress to a `pending_<bookId>` row in `generated` so a tab
  reload can resume.
- Yields control between chunks so the UI thread doesn't lock up.

The banner has a "Review" action that surfaces the in-progress chapter
review when ready.

## File-size guards

- Max import JSON: 200 MB (`handleImportFile` in
  [`22-import-file-format.md`](22-import-file-format.md)).
- No hard cap on PDF size, but the cover-render step eats a lot of RAM for
  large PDFs and iOS may OOM the tab.
- The OCR cleaning chunk size defaults to **1 000 words** to stay under
  Gemini's per-call token limits.

## Sequential vs single-pass processing

Two settings — `useSequential` for chapter detection and a separate one for
OCR cleaning — control whether long books are chunked. Single-pass uses
one big API call (faster, but Gemini cuts off at its output limit).
Sequential chunks ensure no truncation but cost more API calls.

## Error recovery

- Each step is wrapped in `try/catch`; failures set `item.status = 'error'`
  but do not abort the queue.
- Chapter detection has a 3-minute hard timeout (`MAX_DETECTION_TIME`).
- OCR cleaning falls back to original text on any exception.
- User can retry the whole item from the queue panel.

Continue to [`05-ocr-and-extraction.md`](05-ocr-and-extraction.md).
