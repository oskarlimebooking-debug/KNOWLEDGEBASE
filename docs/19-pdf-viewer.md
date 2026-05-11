# 19 — PDF Viewer

`viewOriginalPDF()` (`index.html:22885`) opens a full-screen overlay that
renders the book's stored `pdfData` using PDF.js. It supports two view
modes, rotation, zoom, highlighting, freehand drawing, and saving
annotations back to a downloadable PDF via jsPDF.

## Setup

The PDF.js worker is loaded from cdnjs (cached by the SW):

```js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
```

`renderPdfView()` reads `book.pdfData` (an `ArrayBuffer`) and calls
`pdfjsLib.getDocument({ data })` to obtain a `pdf` object. Total page
count is stored on a per-book module-level state.

## View modes

`setPdfViewMode('scroll' | 'slide')` (`index.html:23178`).

### Scroll mode (`renderScrollView`)

`index.html:22958`. All pages stacked vertically. Implements lazy
rendering via an `IntersectionObserver`:

- `pdfPageVisibilityObserver(el)` — observes a page placeholder div.
- When a page enters the viewport (root margin 200 px), it calls
  `createPageElement(pageNum)` which renders the actual canvas.
- Off-screen pages keep their placeholder, releasing GPU/canvas memory.

This avoids rendering all 300 pages of a textbook upfront.

### Slide mode (`renderSlideView`)

`index.html:23063`. One page at a time with prev / next buttons. The
current page is rendered + the next two are pre-rendered to make
navigation feel instant.

`pdfViewerScrollToPage(pageNum, smooth)` jumps to a specific page (used
by both modes for the page-jump input).

## Page rendering (`createPageElement`)

`index.html:23108`. For a given page number:

1. `page = await pdf.getPage(pageNum)`
2. Get rotation from settings: `pdf_rotation_<bookId>_<pageNum>` (default 0)
3. Apply zoom multiplier (default 1.0) to the viewport
4. Create canvas, `page.render({ canvasContext, viewport })`
5. After render, draw any saved highlights via `renderHighlightsForPage`
6. Return the wrapper div

## Rotation

`rotatePdfPage()` (`index.html:23247`). Rotates the current page +90°
(0/90/180/270 cycle). The new value is saved to
`pdf_rotation_<bookId>_<pageNum>` and `rerenderSinglePage(pageNum)` is
called to update only that page (avoiding a full document re-render).

`savePdfRotations()` is a no-op now (settings are saved per-toggle); the
function is kept for backward compat.

## Zoom

`pdfViewerZoomIn()` / `pdfViewerZoomOut()` adjust a per-book zoom
multiplier and re-render all visible pages. `pdfViewerFitWidth()` measures
the viewer container and sets zoom to fit. The fit-width math accounts
for padding and the scrollbar.

## Highlighter

`togglePdfHighlighter()` (`index.html:23355`) puts the viewer into
highlight mode. The user drags a rectangle on a page; on mouseup, the
rect is added to a `highlights` array.

### Coordinate translation

`getHighlightCoords(e, canvas)` (`index.html:23406`) converts mouse coords
to page-relative percentages so highlights survive zoom changes.

### Multi-color

A color picker dropdown (yellow, pink, green, blue) controls the active
color. An opacity slider (10–100%) tunes the alpha.

`parseOpacityFromColor` and `stripAlphaFromColor` (`index.html:23572–23590`)
let the slider modify existing highlights without recreating them.

### Persistence

After a highlight is committed, `savePdfHighlights()` (`index.html:23592`)
writes the array to `pdf_highlights_<bookId>_<pageNum>` setting key.

`renderHighlightsForPage(pageNum)` (`index.html:23526`) is called every
time a page renders, drawing each saved rect on a transparent overlay.

`clearPdfHighlightsForPage()` removes per-page; `clearPdfHighlights()`
removes all for the current book.

## Pen tool

`togglePdfPen()` (`index.html:23374`) puts the viewer into freehand mode.
Stroke points are recorded in a buffer; on mouseup the path is converted
to an SVG `<path>` and stored alongside highlights with `type: 'path'`.

## Save with annotations (`savePdfWithHighlights`)

`index.html:23635`. Uses jsPDF (cdnjs):

1. Create a new `jsPDF` document with the same page sizes.
2. For each page, render it onto a canvas, embed as JPEG.
3. Overlay the highlights and pen strokes by drawing rectangles + paths
   onto the same jsPDF page (preserving rotation).
4. `doc.save(<title>.pdf)` triggers download.

Note: this uses raster-based rendering, so the resulting PDF is larger
than the original. A vector-based approach using PDF.js's
`getOperatorList` would be ideal but is not implemented.

## UI shell

The PDF viewer has its own dedicated overlay div (`#pdf-viewer-container`,
`index.html:6474`) with:

- Top toolbar: ← Back, Title, Page X of Y, Mode toggle (scroll/slide),
  Zoom controls, Rotate, Highlighter, Pen, Color picker, Opacity slider,
  Clear page, Clear all, Save PDF.
- Main canvas area.
- Loading indicator.

## Memory considerations

Rendering a 600 DPI page eats 30–50 MB of RAM per page on iOS. The
intersection observer keeps off-screen pages cleared. The slide mode
keeps only 3 pages live at a time.

Continue to [`20-settings.md`](20-settings.md).
