# Sprint T: Quality of Life — search, annotations, SRS, theming, definitions, sorts, URL/DOCX import

> One task per T-item in `docs/implementation-plan/phase-t-quality-of-life.md` (N1–N15 in source doc).
> Small-but-significant features that turn a usable reader into a daily habit.

### Phase 1: Search + annotations + SRS

### TT.1 -- Full-text search (⌘K palette) | Cx: 13 | P0

**Description:** Build full-text index in `search.worker.ts` (sprint G). UI: `⌘K` opens palette; search across books + chapters; highlight + click navigates.

**AC:**
- [ ] Indexes full library (10k+ chapters) in < 30s on first build
- [ ] Search latency < 100ms
- [ ] Click result navigates to chapter + scrolls to match
- [ ] Index incremental on add

**Depends on:** TG.7

### TT.2 -- In-text annotations (4-color highlight + notes) | Cx: 13 | P0

**Description:** Highlight text selection in 4 colors. Notes per annotation. Sidebar + popup UI. Store in IDB.

**AC:**
- [ ] All 4 colors persist
- [ ] Notes attached to highlights
- [ ] Drive sync (sprint F) includes annotations
- [ ] Vitest covers selection serialization

**Depends on:** TA.7, TF.7

### TT.3 -- Spaced repetition (SM-2) | Cx: 13 | P1

**Description:** SM-2 algorithm. Review deck per source / global. Daily session UI: Hard / Good / Easy buttons.

**AC:**
- [ ] SM-2 next-review date computed correctly
- [ ] Daily session limits to due cards
- [ ] Stats: streak, retention, time-spent
- [ ] Vitest covers algorithm

**Depends on:** TT.2

### Phase 2: Theming + typography + position memory

### TT.4 -- Theming (dark / light / sepia / system) | Cx: 8 | P1

**Description:** CSS variables. Theme toggle in Settings + per-session. System default.

**AC:**
- [ ] All 4 themes render correctly
- [ ] No flash of unstyled content on theme switch
- [ ] Persists per device
- [ ] Respects `prefers-color-scheme`

**Depends on:** TA.8

### TT.5 -- Adjustable typography | Cx: 5 | P2

**Description:** Font family, font size, line height per reading mode.

**AC:**
- [ ] All 3 controls work
- [ ] Live preview while adjusting
- [ ] Persists per device
- [ ] Accessibility: min/max bounds

**Depends on:** TT.4

### TT.6 -- Position memory (scroll + Resume banner) | Cx: 5 | P1

**Description:** Persist scroll position per chapter. "Resume" banner on library if mid-chapter.

**AC:**
- [ ] Position survives reload
- [ ] Banner shows on library when ANY chapter has saved position
- [ ] Dismiss persists per chapter

**Depends on:** TA.7

### TT.7 -- Word definitions (Wiktionary API) | Cx: 5 | P2

**Description:** Double-click or annotation menu → Wiktionary lookup → popup.

**AC:**
- [ ] Definition shows for common English words
- [ ] Slovenian + other languages fallback gracefully
- [ ] Offline: cached definitions

**Depends on:** TT.2

### TT.8 -- Streak heatmap (53×7 SVG) | Cx: 5 | P2

**Description:** Calendar heatmap of reading activity. 5-level intensity. Includes streak-freeze tokens.

**AC:**
- [ ] Renders accurately for 365+ days
- [ ] Frozen days visually distinct
- [ ] Legend visible

**Depends on:** TA.6

### Phase 3: Collections + sorts + imports

### TT.9 -- Folders / collections | Cx: 8 | P1

**Description:** Pill filter on library. Create / delete collections. Right-click assign.

**AC:**
- [ ] CRUD on collections
- [ ] Multi-collection per source
- [ ] Right-click on mobile (long-press fallback)
- [ ] Drive sync

**Depends on:** TI.4, TS.1

### TT.10 -- Tag filtering with logic | Cx: 5 | P2

**Description:** AND / OR / NOT combinators on tag chips.

**AC:**
- [ ] All 3 operators work
- [ ] Saved filter sets
- [ ] Mobile-friendly

**Depends on:** TT.9

### TT.11 -- Sort options | Cx: 3 | P2

**Description:** Recently added / read / A-Z / completion %.

**AC:**
- [ ] All 4 sorts work
- [ ] Persists per device
- [ ] Live updates on changes

**Depends on:** TI.4

### TT.12 -- URL / web article import | Cx: 5 | P0

**Description:** Add from URL (serverless fetch + extraction). Already in sprint M; this is the QoL surfacing in main UI.

**AC:**
- [ ] Big "Add from URL" button on library
- [ ] Uses sprint M's serverless flow
- [ ] Failure UX clear

**Depends on:** TM.19

### TT.13 -- DOCX / TXT import | Cx: 5 | P1

**Description:** Parse `.docx` (via mammoth) and `.txt`. Same chapter-detection cascade.

**AC:**
- [ ] DOCX with images strips (or includes) cleanly
- [ ] TXT respects line-break paragraphs
- [ ] Chapter detection runs on both

**Depends on:** TM.6

### TT.14 -- Reading reminders (push notifications) | Cx: 8 | P2

**Description:** Push notifications via Service Worker. Daily reminder at user's chosen time.

**AC:**
- [ ] Permission flow respects browser UX
- [ ] Notification clicks open app
- [ ] User can disable / change time
- [ ] iOS limitations documented

**Depends on:** TA.9

### TT.15 -- Anki / Quizlet export | Cx: 5 | P2

**Description:** Export SRS deck as Anki `.apkg` and Quizlet CSV.

**AC:**
- [ ] Anki package opens cleanly in Anki Desktop
- [ ] Quizlet CSV imports cleanly
- [ ] Bidirectional tagging preserved

**Depends on:** TT.3

---

## Sprint enforcement gates (must pass before Sprint U begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — SM-2 algorithm ≥ 95%; search index unit tests
- [ ] **G-Manual** — Real-device test for push notifications (iOS limits documented)
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint U:**

- [ ] Push notification scheduling: per-device or per-account?
- [ ] Search index: in-memory vs IDB-backed
