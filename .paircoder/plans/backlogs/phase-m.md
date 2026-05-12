# Sprint M: Advanced Import — AI-OCR, batch queue, URL/DOI ingestion, cowork format

> One task per T-item in `docs/implementation-plan/phase-m-advanced-import.md` (I1–I18 in source doc).
> Replace simple "Add Source" with batch queue + AI-OCR + smart chapter detection + URL/DOI/OpenAlex enrichment + `chapterwise-import.json` package format.

### Phase 1: Batch queue + OCR pipeline

### TM.1 -- Batch import queue | Cx: 8 | P0

**Description:** Multi-file picker. Queue UI: per-file status (pending/parsing/ocr/done/failed). Minimize button. Cancel halts mid-flight. Sequential processing (parallel optional).

**AC:**
- [ ] 10-file batch completes end-to-end
- [ ] Cancel stops within 1 file
- [ ] Minimize → corner widget still operable
- [ ] Failed file retry-able individually

**Depends on:** TA.4

### TM.2 -- OCR options modal | Cx: 5 | P1

**Description:** Per-file or global options: AI-OCR on/off, provider (Gemini/Merlin), table description, layout hint.

**AC:**
- [ ] All 4 options persist
- [ ] Global default + per-file override works
- [ ] Modal accessible (keyboard nav)

**Depends on:** TM.1

### TM.3 -- AI-OCR via Gemini | Cx: 13 | P1

**Description:** Render PDF page to canvas → base64 → Gemini multimodal call with "Extract text exactly as it appears" prompt. Reassemble pages.

**AC:**
- [ ] Scanned-paper fixture extracts cleanly
- [ ] Cost estimate shown before batch OCR
- [ ] Fallback to text-layer extraction when scan-detected fails
- [ ] Vitest mocks Gemini multimodal

**Depends on:** TM.2, TB.1

### TM.4 -- AI-OCR via Merlin | Cx: 8 | P1

**Description:** Same flow as TM.3 but through `callMerlinAPIWithImage` (sprint K).

**AC:**
- [ ] Merlin path works on same fixtures
- [ ] Falls back to Gemini if Merlin not configured
- [ ] Per-file provider override respected

**Depends on:** TK.4

### TM.5 -- OCR review modal | Cx: 8 | P1

**Description:** Side-by-side preview of original page + extracted text. Per-page edit. Approve/reject.

**AC:**
- [ ] All pages viewable
- [ ] Edit-in-place persists
- [ ] Reject re-runs OCR with adjusted prompt
- [ ] Mobile-friendly

**Depends on:** TM.3

### Phase 2: Chapter detection cascade

### TM.6 -- Chapter detection cascade | Cx: 8 | P0

**Description:** Try in order: explicit ToC → pattern match (sprint B) → sequential (TM.7) → smart word-count (TM.8). First strategy with ≥ 2 valid splits wins.

**AC:**
- [ ] Cascade documented + tested
- [ ] Each strategy has a name in the detection metadata
- [ ] Vitest covers all 4 paths

**Depends on:** TB.3

### TM.7 -- Sequential chapter detection details | Cx: 5 | P2

**Description:** Detect chapter heading style by scanning for repeated formatting (font size, bold, isolation).

**AC:**
- [ ] Works on textbooks with consistent heading style
- [ ] Doesn't false-positive on body text
- [ ] Vitest with 3+ fixtures

**Depends on:** TM.6

### TM.8 -- Smart word-count split | Cx: 5 | P2

**Description:** Default 2000 words/chapter (sprint A baseline) but tries to split on natural paragraph breaks within ±20%.

**AC:**
- [ ] Splits land on paragraph boundaries
- [ ] Length within ±20% of target
- [ ] No mid-sentence splits

**Depends on:** TM.6

### TM.9 -- Chapter review modal (post-detection editor) | Cx: 8 | P1

**Description:** Visual list of detected chapters. Drag-to-reorder, merge, split, rename.

**AC:**
- [ ] All 4 operations work
- [ ] Live preview of chapter content
- [ ] Cancel discards changes
- [ ] Save commits in single transaction

**Depends on:** TM.6

### TM.10 -- Manual chapter editor | Cx: 5 | P2

**Description:** Edit chapter content directly post-import.

**AC:**
- [ ] Plaintext editor with markdown support
- [ ] Save debounced
- [ ] Revert button
- [ ] Word count live

**Depends on:** TM.9

### TM.11 -- Resplit existing books | Cx: 5 | P2

**Description:** "Resplit Chapters" action on book detail. Regenerates chapter list from raw text using current detection settings.

**AC:**
- [ ] Confirms before destroying existing chapters
- [ ] Preserves progress + generated content where possible (map old → new by content similarity)
- [ ] Rollback on failure

**Depends on:** TM.6

### Phase 3: Title prediction + covers + URL/DOI

### TM.12 -- Title prediction | Cx: 3 | P2

**Description:** AI inference from first page when metadata missing.

**AC:**
- [ ] Returns single best guess
- [ ] User can override
- [ ] Confidence indicator

**Depends on:** TB.1

### TM.13 -- Cover generation in import | Cx: 5 | P2

**Description:** Auto-cover from PDF page 1 OR emoji-fallback for non-PDF.

**AC:**
- [ ] All 4 source kinds get a cover
- [ ] PDF cover under 200KB JPEG
- [ ] Emoji fallback matches kind

**Depends on:** TA.4

### TM.14 -- Import package format (chapterwise-import.json) | Cx: 13 | P0

**Description:** Full envelope spec: `version`, `type`, `sources`, `chapters`, `projects`, `project_sections`, `citations`. Documented in `22-import-file-format.md`. Idempotent upsert by ID.

**AC:**
- [ ] zod schema covers all 7 fields
- [ ] Versioned (v1, v2 supported)
- [ ] Vitest fixtures for each top-level type
- [ ] External tool docs published (for Claude pipeline skill)

**Depends on:** TI.5, TH.6

### TM.15 -- Auto-detect local import | Cx: 5 | P2

**Description:** `checkForLocalImport` scans Downloads + temp folders for known package files. Surface banner.

**AC:**
- [ ] Banner surfaces on detection
- [ ] Dismiss persists per-file
- [ ] No false positives

**Depends on:** TM.14

### TM.16 -- File picker / paste import | Cx: 3 | P2

**Description:** "Paste JSON" button parses + imports.

**AC:**
- [ ] Paste validates + imports
- [ ] Clear error on malformed input
- [ ] Large paste (1MB) doesn't hang UI

**Depends on:** TM.14

### TM.17 -- Background processing | Cx: 8 | P1

**Description:** Push parsing + OCR + chapter detection to web workers (sprint G).

**AC:**
- [ ] No main-thread freezes during 10-file batch
- [ ] Worker errors surface to UI
- [ ] Cancellable mid-task

**Depends on:** TG.7, TM.1

### TM.18 -- .gitignore additions | Cx: 1 | P3

**Description:** Add fixture-import and OCR-cache temp paths to `.gitignore`.

**AC:**
- [ ] No temp files committed

**Depends on:** TM.1

### Phase 4: URL/DOI ingestion (M-extensions)

### TM.19 -- Article URL ingestion | Cx: 8 | P1

**Description:** "Add from URL" flow: serverless fetch → article extraction (Readability.js or similar) → creates `Source` with `kind: 'url'`.

**AC:**
- [ ] Live test on 5+ URLs (news, blog, paper)
- [ ] Paywall-blocked URLs surface helpful message
- [ ] Article body extracted cleanly
- [ ] Author, date, title metadata populated

**Depends on:** TI.4

### TM.20 -- DOI lookup (CrossRef proxy) | Cx: 5 | P1

**Description:** Vercel proxy `/api/lookup/doi.ts` (CrossRef wrapper). Cache results.

**AC:**
- [ ] Proxy deploys
- [ ] DOI resolves to full metadata
- [ ] Cache TTL 24h
- [ ] No CrossRef key required (public API)

**Depends on:** TK.10

### TM.21 -- OpenAlex enrichment (proxy) | Cx: 5 | P1

**Description:** Vercel proxy `/api/lookup/openalex.ts` (OpenAlex wrapper). Enriches DOI / title with full citation graph.

**AC:**
- [ ] Proxy deploys
- [ ] Enrichment populates citation count, references, etc.
- [ ] Cache TTL 24h

**Depends on:** TK.10

---

## Sprint enforcement gates (must pass before Sprint N begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — coverage ≥ 86%; OCR cascade ≥ 80% branch
- [ ] **G-Manual** — Real-device test: 5-file batch with mixed PDF + scanned + URL
- [ ] **G-Security** — proxies don't log keys; DOI/OpenAlex don't require any
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint N:**

- [ ] Default OCR provider (Gemini multimodal vs Merlin)
- [ ] Cache TTL for DOI/OpenAlex
