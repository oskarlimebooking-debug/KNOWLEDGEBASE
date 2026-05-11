# Sprint S: Cross-source Intelligence — book-level + multi-book + cross-book features

> One task per T-item in `docs/implementation-plan/phase-s-cross-source-intelligence.md` (L1–L12 in source doc).
> Talk to your whole library at once: book-level feed, multi-book feed, cross-book feed, book mind map, batch chat.

### Phase 1: Library multi-select + tagging

### TS.1 -- Library multi-select | Cx: 5 | P0

**Description:** Long-press / shift-click selects multiple sources. Top action bar appears.

**AC:**
- [ ] All 3 input modes work (touch / shift / drag-rect)
- [ ] Selection count visible
- [ ] Escape clears selection
- [ ] Mobile-friendly

**Depends on:** TI.4

### TS.2 -- Batch tagging | Cx: 5 | P1

**Description:** Apply tag to all selected sources at once.

**AC:**
- [ ] Idempotent: re-applying same tag is no-op
- [ ] Confirm before bulk operation
- [ ] Undo within 10s

**Depends on:** TS.1

### Phase 2: Book + multi-book generations

### TS.3 -- Book mind map | Cx: 8 | P1

**Description:** Mind map spanning whole book (vs single chapter sprint C). Cache `mindmap_book_<sourceId>`.

**AC:**
- [ ] Renders all chapters
- [ ] Re-uses sprint C SVG renderer
- [ ] Click branch → navigates to chapter

**Depends on:** TC.1

### TS.4 -- Book feed | Cx: 8 | P1

**Description:** Twitter feed spanning whole book. Reuse sprint D prompt with book content. Cache `feed_book_<sourceId>`.

**AC:**
- [ ] 20 posts spanning chapters
- [ ] Per-post chapter attribution
- [ ] Cache works

**Depends on:** TD.2, TD.3

### TS.5 -- Multi-book feed | Cx: 8 | P1

**Description:** Synthesize feed across selected books. New prompt joining titles + summaries.

**AC:**
- [ ] 20 posts cross-referencing books
- [ ] Per-post source attribution
- [ ] Cache `feed_multi_<hash>` keyed by sorted source IDs

**Depends on:** TS.1, TD.3

### TS.6 -- Cross-book feed | Cx: 8 | P2

**Description:** One chapter through the lens of another book. Prompt template injecting both contents.

**AC:**
- [ ] 20 posts
- [ ] Voice clearly belongs to "lens" book
- [ ] Cache `feed_cross_<chapterId>_<otherSourceId>`

**Depends on:** TD.3

### Phase 3: Batch chat + bookkeeping + power-ops

### TS.7 -- Multi-book Ask (batch chat) | Cx: 13 | P1

**Description:** Conversation component over multiple selected books. Truncation strategy: prefer titles + summaries on overflow.

**AC:**
- [ ] Handles 5+ selected books
- [ ] Citation: each AI response cites source(s) used
- [ ] No persistence by default

**Depends on:** TC.5, TS.1

### TS.8 -- Generation bookkeeping | Cx: 5 | P1

**Description:** Track which sources contributed to which generation. Surfaced in cache rows.

**AC:**
- [ ] `sourceIds` array stored per generation row
- [ ] Visible in Diagnostics page
- [ ] Used for cache invalidation when a source is deleted

**Depends on:** TS.4

### TS.9 -- Sync extension | Cx: 3 | P0

**Description:** Add book-level + multi-book generation rows to envelope.

**AC:**
- [ ] Round-trip preserves all
- [ ] Backward compat handled

**Depends on:** TF.7

### TS.10 -- Failure handling | Cx: 3 | P1

**Description:** Per-source generation failure doesn't fail the batch.

**AC:**
- [ ] Partial results returned with error markers
- [ ] User can retry only failed sources
- [ ] Clear UX showing what succeeded vs failed

**Depends on:** TS.7

### TS.11 -- Library "Generate All" power-ops | Cx: 5 | P2

**Description:** Bulk generate (feed/summary/quiz) for all selected sources.

**AC:**
- [ ] Progress bar per operation
- [ ] Cost estimate displayed pre-bulk
- [ ] Cancellable

**Depends on:** TS.1, TS.8

### TS.12 -- Empty / sparse states | Cx: 3 | P2

**Description:** Friendly empty states for cross-source views when < 2 sources or selected set is empty.

**AC:**
- [ ] All cross-source views have empty states
- [ ] Calls-to-action point to "Select sources" or "Add source"

**Depends on:** TS.1

---

## Sprint enforcement gates (must pass before Sprint T begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — multi-source truncation tested with 5+ source fixture
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint T:**

- [ ] Persistence for Multi-book Ask?
- [ ] Cost-cap warning thresholds
