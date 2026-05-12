# Sprint N: PDF Viewer with Annotations

> One task per T-item in `docs/implementation-plan/phase-n-pdf-viewer.md` (J1–J16 in source doc).
> Full-screen PDF viewer using `book.pdfData` (or OPFS ref post-G): scroll/slide, rotation, zoom, multi-color highlight, freehand pen, save annotated copy via jsPDF.

### Phase 1: Viewer shell + rendering

### TN.1 -- PDF.js setup (worker via cdnjs) | Cx: 5 | P0

**Description:** Load PDF.js worker. Configure `GlobalWorkerOptions.workerSrc`. Workers loaded only when viewer mounts (lazy).

**AC:**
- [ ] Worker loads on demand
- [ ] No console errors
- [ ] Bundle delta < 200KB (PDF.js loaded lazily)

**Depends on:** TG.7, TG.11

### TN.2 -- Viewer shell | Cx: 5 | P0

**Description:** Full-screen overlay with header (close, mode toggle, rotation, zoom, page nav).

**AC:**
- [ ] Opens / closes cleanly
- [ ] Header controls accessible
- [ ] Loading spinner during initial render

**Depends on:** TN.1

### TN.3 -- Document load | Cx: 5 | P0

**Description:** Load PDF from `book.pdfData` (sprint A) or OPFS ref (sprint G).

**AC:**
- [ ] Loads both legacy + OPFS-stored PDFs
- [ ] Failure surfaces with reload option
- [ ] Memory profile reasonable on 200-page doc

**Depends on:** TN.2, TG.5

### TN.4 -- Scroll mode | Cx: 5 | P1

**Description:** Continuous vertical scroll, virtualized so only nearby pages render.

**AC:**
- [ ] 60fps scroll on 200-page textbook
- [ ] Page anchor visible in URL
- [ ] Keyboard arrow + PgUp/PgDn scroll

**Depends on:** TN.3

### TN.5 -- Slide mode | Cx: 5 | P1

**Description:** Single-page view with swipe / arrow nav.

**AC:**
- [ ] Swipe gestures on mobile
- [ ] Keyboard arrows on desktop
- [ ] Preserves scroll position when toggling modes

**Depends on:** TN.3

### TN.6 -- Page rendering | Cx: 8 | P0

**Description:** Render pages to canvas via PDF.js at devicePixelRatio. Cache rendered pages.

**AC:**
- [ ] Crisp rendering at any zoom
- [ ] Cache evicts oldest pages when memory pressured
- [ ] No flicker on zoom changes

**Depends on:** TN.4, TN.5

### Phase 2: Rotation + zoom

### TN.7 -- Rotation | Cx: 3 | P2

**Description:** 0°/90°/180°/270° rotation per document or per page.

**AC:**
- [ ] All 4 rotations render correctly
- [ ] State persists per-document in IDB
- [ ] Annotations rotate with page

**Depends on:** TN.6

### TN.8 -- Zoom | Cx: 5 | P1

**Description:** Pinch-zoom on mobile; Ctrl+scroll on desktop. Fit-to-width / fit-to-page presets.

**AC:**
- [ ] Smooth pinch-zoom
- [ ] Presets work
- [ ] Doesn't fight browser-native zoom

**Depends on:** TN.6

### Phase 3: Annotations (highlighter + pen)

### TN.9 -- Highlighter (4 colors) | Cx: 13 | P0

**Description:** Multi-color highlight tool. Text selection or drag-region. Persists per book in IDB.

**AC:**
- [ ] All 4 colors selectable
- [ ] Highlight aligns to text bounding boxes
- [ ] Persistence round-trips through IDB
- [ ] Mobile touch selection works
- [ ] Erase highlight by tap

**Depends on:** TN.6

### TN.10 -- Pen tool (freehand) | Cx: 13 | P1

**Description:** Pressure-sensitive (where supported), color + thickness picker, undo/redo.

**AC:**
- [ ] Smooth stroke on iPad with Apple Pencil
- [ ] Undo/redo stack ≥ 50 ops
- [ ] Persists per page
- [ ] No latency > 16ms during draw

**Depends on:** TN.6

### TN.11 -- Persistence (annotations IDB) | Cx: 5 | P0

**Description:** Store annotations in a new IDB store `pdf_annotations` keyed by `<bookId>_p<page>`.

**AC:**
- [ ] Zod schema for annotation row
- [ ] Live-load on viewer mount
- [ ] Survives reload
- [ ] Drive sync (sprint F) includes the store

**Depends on:** TN.9, TN.10

### TN.12 -- Clear annotations | Cx: 3 | P2

**Description:** Clear-all or clear-current-page button with confirmation.

**AC:**
- [ ] Confirms before clearing
- [ ] Live updates UI
- [ ] Drive sync reflects after

**Depends on:** TN.11

### TN.13 -- Save with annotations (jsPDF) | Cx: 13 | P1

**Description:** Render annotated PDF via jsPDF + html2canvas (or PDF.js native annotation API if viable). Download.

**AC:**
- [ ] Output opens in Preview / Adobe Reader
- [ ] Highlight + pen both preserved
- [ ] Page count matches source
- [ ] Documented size delta (annotations add < 20%)

**Depends on:** TN.11

### Phase 4: Touch + settings + sync

### TN.14 -- Touch support | Cx: 5 | P1

**Description:** Long-press to select, two-finger pan + zoom, palm rejection during pen.

**AC:**
- [ ] No accidental highlights from palm
- [ ] Long-press reliable on iOS + Android
- [ ] Two-finger pan doesn't trigger pen

**Depends on:** TN.9, TN.10

### TN.15 -- Settings additions | Cx: 3 | P2

**Description:** Default tool, default highlighter color, default pen color/thickness, fit mode.

**AC:**
- [ ] All settings persist
- [ ] Take effect on next viewer open

**Depends on:** TA.8

### TN.16 -- Sync extension (pdf_annotations) | Cx: 3 | P1

**Description:** Add `pdf_annotations` to Drive sync envelope.

**AC:**
- [ ] Round-trip preserves all per-page annotations
- [ ] Backward-compat: missing field handled

**Depends on:** TF.7, TN.11

---

## Sprint enforcement gates (must pass before Sprint O begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Manual** — Real-device test on iPad with Apple Pencil
- [ ] **G-Tests** — annotation persistence ≥ 86%; jsPDF round-trip ≥ 80%
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint O:**

- [ ] Vector annotations on PDFs (sprint Y) or raster baseline?
- [ ] PDF.js native annotation API vs in-house overlay
