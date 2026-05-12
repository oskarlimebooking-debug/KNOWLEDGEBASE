# Sprint O: Writing Hub — Outline + streaming AI drafts + section editor

> One task per T-item in `docs/implementation-plan/phase-o-writing-hub.md` (T1–T15 in source doc).
> Top-level Writing pillar: Dashboard, Outline, Section Editor. Streaming AI drafts per section (NDJSON protocol). Word counts, status tracking.

### Phase 1: Plumbing + routes

### TO.1 -- useWritingStore (Zustand) | Cx: 5 | P0

**Description:** Current section, content (debounced save), word count, dirty flag, last-saved timestamp.

**AC:**
- [ ] Reactive across components
- [ ] Persisted dirty state across reload
- [ ] Vitest covers transitions

**Depends on:** TH.4

### TO.2 -- /writing route + no-project redirect | Cx: 3 | P0

**Description:** `/writing` route. Redirect to project picker if `activeProjectId === null`.

**AC:**
- [ ] Redirect logic verified
- [ ] Deep-linking works
- [ ] Mobile: nav focuses on writing on entry

**Depends on:** TH.3, TO.1

### TO.3 -- WritingHubDashboard | Cx: 8 | P1

**Description:** Read sections via Dexie LiveQuery, show progress (word count vs target), status chips per section, recently-edited list, quick "New section" action.

**AC:**
- [ ] LiveQuery reactivity confirmed
- [ ] Progress bar accurate
- [ ] Status chips: idea, drafting, review, done
- [ ] Mobile-friendly

**Depends on:** TO.2

### Phase 2: Outline + editor

### TO.4 -- OutlineTree | Cx: 8 | P1

**Description:** Collapsible tree of sections, status colors, drag-to-reorder.

**AC:**
- [ ] Drag-to-reorder persists
- [ ] Indentation up to 4 levels
- [ ] Keyboard navigable
- [ ] Color reflects status

**Depends on:** TO.3

### TO.5 -- SectionEditor shell | Cx: 8 | P0

**Description:** Three-panel layout: outline (left), editor (center), AI panel (right). Toolbar with status select, word count, save indicator.

**AC:**
- [ ] All 3 panels resizable
- [ ] Status select live-updates outline tree
- [ ] Word count live
- [ ] Mobile: panels collapse into tabs

**Depends on:** TO.4

### TO.6 -- Auto-save (debounce 1.5s + Saved pill) | Cx: 5 | P0

**Description:** Debounce 1.5s; show green "Saved" pill for 2s after each write.

**AC:**
- [ ] Saves within 1.5s of stopping typing
- [ ] Pill animation runs once per save
- [ ] No race conditions on rapid edits
- [ ] Vitest mocks timing

**Depends on:** TO.5

### Phase 3: Streaming AI drafts (NDJSON)

### TO.7 -- NDJSON streaming protocol | Cx: 8 | P0

**Description:** Per `docs/33-streaming-ai-and-ndjson.md`. Each line is a JSON object with `event` ('token' | 'meta' | 'done' | 'error') and payload.

**AC:**
- [ ] All 4 event types handled
- [ ] Parser robust to mid-line interruptions
- [ ] Vitest fuzzes malformed lines
- [ ] Documented in `docs/33-streaming-ai-and-ndjson.md`

**Depends on:** TG.6

### TO.8 -- Vercel /api/generate/stream.ts | Cx: 8 | P0

**Description:** Node.js runtime. Receives prompt + apiKey + provider; opens upstream stream; relays as NDJSON. **Includes apiKey from body** (fixing TC bug).

**AC:**
- [ ] Deploys on Vercel
- [ ] Stream relays from Gemini / Merlin / Perplexity
- [ ] No key persistence server-side
- [ ] Timeout 120s

**Depends on:** TK.10

### TO.9 -- Client streaming parser | Cx: 5 | P0

**Description:** `TextDecoder` + buffer. Handle chunked deliveries. Update AI panel token-by-token.

**AC:**
- [ ] Smooth UI updates at 30+ tokens/s
- [ ] Backpressure: rapid tokens don't jank
- [ ] Error event surfaces in UI
- [ ] Vitest covers parser with simulated chunks

**Depends on:** TO.8

### TO.10 -- Prompt builder | Cx: 8 | P1

**Description:** Embed full outline + project metadata (kind, language, hypotheses, writing style, target word count). Use `prompt_writingDraft` template.

**AC:**
- [ ] Deterministic for same inputs
- [ ] Vitest snapshot of generated prompts
- [ ] Respects writingStyle from sprint H

**Depends on:** TH.9

### TO.11 -- "Use as Base" button | Cx: 3 | P1

**Description:** `setContent(aiDraft)`. Debounced save.

**AC:**
- [ ] Replaces editor content
- [ ] Triggers auto-save
- [ ] Confirm dialog when editor is dirty

**Depends on:** TO.6, TO.9

### Phase 4: Word count + resume + editor + tests

### TO.12 -- Word count (Intl.Segmenter + fallback) | Cx: 5 | P1

**Description:** Multilingual word count via `Intl.Segmenter`. Fallback for older Safari.

**AC:**
- [ ] Accurate for English, German, Chinese, Arabic, Slovenian (project's primary)
- [ ] Fallback within ±5% of `Intl.Segmenter`
- [ ] Live update under 50ms

**Depends on:** TO.5

### TO.13 -- Auto-resume last section | Cx: 3 | P2

**Description:** Store `lastSectionId_<projectId>` in settings. Restore on `/writing` open.

**AC:**
- [ ] Resume works across reload
- [ ] Per-project memory
- [ ] Override on explicit nav

**Depends on:** TO.5

### TO.14 -- Markdown editor MVP | Cx: 5 | P1

**Description:** Plain `<textarea>` first cut. (Rich text deferred to follow-up.)

**AC:**
- [ ] Markdown preview pane (toggle)
- [ ] Tab inserts 2 spaces
- [ ] Mobile virtual-keyboard friendly

**Depends on:** TO.5

### TO.15 -- Tests | Cx: 5 | P1

**Description:** Vitest unit tests on prompt builder, NDJSON parser. Playwright e2e: create project → enter section → stream draft → use as base → save → reload → see content.

**AC:**
- [ ] Unit coverage ≥ 86%
- [ ] e2e green
- [ ] NDJSON parser fuzz tested

**Depends on:** TO.11, TO.12

---

## Sprint enforcement gates (must pass before Sprint P begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — NDJSON parser ≥ 90%; word count multilingual verified
- [ ] **G-Security** — `/api/generate/stream` never persists keys
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint P:**

- [ ] Rich-text editor (TipTap / Lexical) when?
- [ ] Per-section AI prompt customization
