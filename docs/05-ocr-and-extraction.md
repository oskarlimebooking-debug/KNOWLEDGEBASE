# 05 — OCR and Text Extraction

The app supports four levels of text extraction, each progressively heavier
but more reliable on poorly-OCRed or scanned PDFs:

1. **PDF.js text-layer only** (no OCR) — fastest, fails on scanned PDFs.
2. **AI-OCR via Gemini** — renders each page as JPEG, sends to Gemini.
3. **AI-OCR via Merlin** — same, but free-via-Merlin instead of Gemini.
4. **AI-OCR with page-by-page review** — same as 2/3, but the user can
   accept/edit/skip each page before commit.

EPUBs go through a fifth dedicated path (JSZip + HTML strip).

## 1. PDF.js text extraction (`extractPDFContent`)

`index.html:9333`. The function works around PDF.js's per-fragment text
output by reconstructing structure from the transform matrix:

- For every `pdf.getPage(i).getTextContent().items` array, it tracks the
  Y position to detect line breaks and the X position to detect columns
  and indented bullets.
- Bullet characters: `• ● ○ ◦ ▪ ▫ ■ □ ► ▸ ‣ ⁃ - – — * ·`.
- Numbered/lettered lists: `1.`, `2)`, `a:`.
- Two thresholds: 0.8× the avg line-height = same line; 1.8× = paragraph
  break.
- Whitespace cleanup: collapse 3+ spaces, trim trailing spaces, normalize
  triple newlines to double.
- The first non-empty line of page 1 (truncated to 100 chars) is used as
  the auto-extracted title.

Output: `{ text, title }` where `text` is plain UTF-8 with `\n\n` between
paragraphs.

## 2. EPUB extraction (`extractEPUBContent`)

`index.html:9495`. Uses `JSZip` from cdnjs:

1. Read `META-INF/container.xml` to find the OPF path.
2. Read the OPF and pull `<dc:title>` for the book title.
3. Iterate every entry whose path matches `\.(x?html?)$` and is not a TOC
   or nav file. Sort alphabetically (assumes filename = ordering).
4. For each, strip `<script>` and `<style>` blocks, convert block tags
   (`<p> <div> <h1-6> <li> <blockquote> <section> <article>`) to `\n\n`,
   `<br>` to `\n`, drop everything else, decode HTML entities, collapse
   whitespace.
5. Skip files with < 100 chars (boilerplate filtering).

This is intentionally simple — it does not attempt to parse the OPF spine
order, so weird EPUBs may produce out-of-order content.

## 3. AI-OCR via Gemini (`extractPDFWithAI`)

`index.html:7572`. The heavy hitter.

For each page:

1. Render `page.getViewport({ scale: 2.0 })` onto an HTML canvas.
2. `canvas.toDataURL('image/jpeg', 0.85)` and split off the base64 prefix.
3. Build a prompt that asks Gemini to extract **body text only** —
   excluding page numbers, headers, footers, footnotes, and figure
   numbering — with optional add-ons (chapter markers, citation removal,
   table-to-prose).
4. POST to
   `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
   with the image inline as a `parts` entry.
5. If `finishReason === 'MAX_TOKENS'`, retry the page once with a higher
   limit.
6. If extraction failed completely, fall back to PDF.js text for that
   page so we don't lose pages entirely.

### Continuity context

A neat trick: the prompt includes the **last 40 words of the previous
page** so Gemini knows the prior context and can fix sentence-spanning
hyphenations. The variable is `continuityContext` in the loop.

### Page review accumulator

Each page's extracted text + the rendered image are pushed into
`pagesForReview` so the optional review modal (`openOCRReviewModal`,
`index.html:7771`) can display them with thumbnails.

### Output

After all pages: a single `text` string concatenated with `\n\n` between
pages. The review modal can edit any page; on commit it returns the
updated text.

## 4. AI-OCR via Merlin (`extractPDFWithMerlin`)

`index.html:7782`. Same pattern, but uses `callMerlinAPIWithImage`.
Merlin offers two modes:

- **`text`** — Merlin runs an internal OCR + cleanup; we send the page
  image and ask "extract body text".
- **`image`** — Merlin runs the prompt against the image directly.

The two modes differ in cost and quality; `text` is cheaper but slightly
worse on academic figures.

## 5. Page-by-page review modal (`openOCRReviewModal`)

`index.html:7771` and the modal HTML in the body. Displays:

- Thumbnail of the rendered page (the JPEG we sent to the AI).
- The extracted text in an editable `<textarea>`.
- **Re-OCR this page** button (re-fires the same prompt).
- **Skip page** (drops content for that page entirely).
- **Accept** button moves to next page.

Returns a Promise (`ocrReviewResolve`) that resolves with the final
concatenated text once the user reaches the last page.

## OCR options that flow into the prompt

| Option | When set | Prompt effect |
|--------|----------|---------------|
| Chapter markers | `enableOCRChapterMarkers` | "Insert `/chapter/` markers above each section heading" |
| Remove citations | `enableOCRRemoveCitations` | "Remove inline `[1]`, `(Smith et al., 2020)`, footnote markers" |
| Describe tables | `enableOCRDescribeTables` | "Convert tables/graphs to natural-language descriptions" |

These map to "extra instructions" inserted into the per-page prompt.

## Fallback chain

```
preferred:    AI-OCR (Gemini or Merlin)  ← user chose
on AI fail:   PDF.js text for that page
on PDF.js fail: skip page (warn user)
on no AI:     PDF.js text-only for the entire book
```

## Performance notes

- Rendering a page at 2× scale on iOS Safari takes ~600 ms / page.
- Gemini Flash takes ~2–4 s / page.
- For a 300-page book, expect ~15 minutes wall-clock.
- The user is not blocked — the persistent progress banner shows
  `processed / total` and keeps the rest of the app interactive.

## Future improvements

See [`24-future-development.md`](24-future-development.md) for a longer
list. Key items:

- **Tesseract WASM in a Web Worker** as a free local fallback when no AI
  provider is configured.
- **Parallel page extraction** with controlled concurrency (currently
  sequential).
- **Smart page-skip** — detect blank pages and skip the API call.
- **Diff view** in the review modal (PDF.js text vs AI text side-by-side).

Continue to [`06-chapter-detection.md`](06-chapter-detection.md).
