# Phase J — PDF Viewer with Annotations

> **Tagline:** Open the original PDF, highlight, draw, save with marks.

## Goal

Build a full-screen PDF viewer that lets the user open the original
binary stored in `book.pdfData`. Support scroll and slide views,
rotation, zoom, multi-color highlights, freehand pen tool, and
saving an annotated copy via jsPDF.

## Why this phase / rationale

Users importing PDFs often want to consult the original layout —
figures, tables, equations, page numbers — without losing the AI-
processed text. They also want to mark up academic papers in place.
Building this on top of PDF.js gets us 80% of a desktop reader for
free; the remaining 20% (annotations + save) is what makes the
feature feel native.

This is also the phase that exercises the `pdfData` storage path most
heavily, validating the Phase A storage decision.

## Prerequisites

- Phase A (PDF.js loaded, `book.pdfData` stored).
- Phase F (sync — annotations should sync per-page).

## Deliverables

- Full-screen PDF viewer overlay opened from the book detail.
- Scroll and slide view modes.
- Rotation persistence per page.
- Zoom in / out / fit-width.
- Multi-color highlighter with opacity slider.
- Freehand pen tool.
- Per-page clear, all-pages clear.
- Save annotated PDF via jsPDF.
- Lazy page rendering via IntersectionObserver.

## Task breakdown

### J1 — PDF.js setup

CDN scripts:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

Lazy-load on `viewOriginalPDF()` so the viewer's payload only
materializes when used.

```js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
```

### J2 — Viewer shell

`#pdf-viewer-container` overlay with:
- Top toolbar: Back, Title, Page X/Y, Mode toggle, Zoom controls,
  Rotate, Highlighter, Pen, Color picker, Opacity slider, Clear page,
  Clear all, Save PDF.
- Main area with rendered pages or loading spinner.

Toggle visible via `viewOriginalPDF()` from the book detail.

### J3 — Document load

```js
const pdf = await pdfjsLib.getDocument({ data: book.pdfData }).promise;
totalPages = pdf.numPages;
```

Cache the `pdf` object at module scope for the duration of the viewer
session.

### J4 — Scroll mode

`renderScrollView()`:
- Render each page as a placeholder div (no canvas yet).
- Attach an `IntersectionObserver` with `rootMargin: 200px`.
- When a placeholder enters the viewport, replace it with a rendered
  canvas via `createPageElement(pageNum)`.
- Released pages keep their placeholder (no canvas memory).

### J5 — Slide mode

`renderSlideView()`:
- Show only the current page.
- Pre-render the next two pages (for instant Next).
- Buttons: ← Prev / Next →.

`pdfViewerScrollToPage(n, smooth)` — used by both modes for the
"jump to page" input.

### J6 — Page rendering

`createPageElement(pageNum)`:

```js
const page = await pdf.getPage(pageNum);
const rotation = (await getSetting(`pdf_rotation_${bookId}_${pageNum}`)) || 0;
const viewport = page.getViewport({ scale: zoom, rotation });
const canvas = document.createElement('canvas');
canvas.width = viewport.width;
canvas.height = viewport.height;
await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
renderHighlightsForPage(pageNum); // overlay
```

### J7 — Rotation

`rotatePdfPage()`:
- Read current rotation, add 90° (mod 360).
- Save to `pdf_rotation_<bookId>_<pageNum>`.
- `rerenderSinglePage(pageNum)` to update only that page.

### J8 — Zoom

- `pdfViewerZoomIn()` / `pdfViewerZoomOut()` adjust zoom multiplier
  (range 0.5 to 3.0).
- `pdfViewerFitWidth()` measures the container, sets zoom to fit.
- Re-render visible pages after a zoom change.

### J9 — Highlighter

`togglePdfHighlighter()` enters highlight mode. The user drags a
rectangle on a page; on mouseup the rect is added to the highlights
array.

`getHighlightCoords(e, canvas)` converts mouse to page-relative
percentages:
```js
{
  x:      (e.clientX - rect.left) / rect.width,
  y:      (e.clientY - rect.top) / rect.height,
  width:  ...
}
```

Color picker dropdown (yellow / pink / green / blue) with an opacity
slider (10–100%). `parseOpacityFromColor`, `stripAlphaFromColor`
helpers let the slider edit existing highlights without recreating.

### J10 — Pen tool

`togglePdfPen()` enters freehand mode. Stroke points are buffered;
on mouseup the path is converted to an SVG `<path>` and stored
alongside highlights with `type: 'path'`.

### J11 — Persistence

After every annotation:
```js
await setSetting(`pdf_highlights_${bookId}_${pageNum}`, JSON.stringify(highlights));
```

`renderHighlightsForPage(pageNum)` runs after every page render and
draws all saved rects + paths on a transparent overlay.

### J12 — Clear

- `clearPdfHighlightsForPage()` — wipes the current page's highlights.
- `clearPdfHighlights()` — wipes all pages for this book (with confirm).

### J13 — Save with annotations

`savePdfWithHighlights()`:
- Create a jsPDF document with the same page sizes.
- For each page:
  - Render onto a high-DPI canvas.
  - Embed as JPEG.
  - Overlay highlights / pen strokes by drawing rectangles and paths
    onto the same jsPDF page (preserving rotation).
- `doc.save('<title>.pdf')` triggers download.

Document the limitation: this is **raster** rendering, so the output
is larger than the original and not searchable. A vector approach
using `pdf.getOperatorList()` is possible but expensive to implement
(see Phase R).

### J14 — Touch support

Highlighter and pen need touch events:
- `touchstart` / `touchmove` / `touchend` translated to the same
  coordinate logic.
- Multi-touch ignored (one finger only for drawing).

### J15 — Settings additions

- Per-book "Default view mode" (scroll / slide).
- Default highlighter color.

### J16 — Sync extension

PDF rotation and highlight settings (`pdf_rotation_*` and
`pdf_highlights_*`) are **not** synced by default — they're
device-context-specific. Add an opt-in toggle "Sync annotations
across devices" that adds these prefixed keys to the sync whitelist.

## Acceptance criteria

- [ ] User can open a PDF that was imported in Phase A.
- [ ] Scroll mode lazy-loads pages on viewport entry.
- [ ] Slide mode advances and pre-loads.
- [ ] Rotation persists on a per-page basis.
- [ ] Zoom in / out / fit-width work.
- [ ] Highlighter creates rectangles in 4 colors with opacity control.
- [ ] Pen tool draws smooth strokes.
- [ ] Annotations survive close-and-reopen.
- [ ] "Save annotated PDF" produces a downloadable file with the
      annotations baked in.
- [ ] Viewer doesn't OOM on a 600-page textbook.

## Effort estimate

- **T-shirt:** M
- **Person-weeks:** 2–3
- **Critical path:** highlight coordinate translation across rotation +
  zoom.

## Risks & unknowns

- **Memory** — rendering at high DPI can OOM on iOS for large PDFs.
  IntersectionObserver helps; aggressive page eviction on memory
  pressure events helps more.
- **jsPDF size** — adds ~250 KB to the viewer bundle. Lazy-load.
- **Touch DnD** for the pen tool can fight with browser scroll.
  `touch-action: none` on the canvas + careful event handling.
- **Coordinate math under rotation** — highlights drawn before
  rotation must transform correctly when the user rotates. Test all
  four orientations.

## Out of scope

- Vector annotations (Phase R).
- OCR-aware "highlight by selecting text" (Phase R).
- Sticky notes / comments on highlights (Phase N's annotations system
  could be extended).

## Decision points before Phase K

- [ ] Decide whether to sync annotations by default or opt-in.
- [ ] Decide whether to support multi-touch gestures (pinch-zoom)
      now or later.

---

Continue to [Phase K — Video & Image Generation](phase-k-video-and-images.md).
