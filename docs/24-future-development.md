# 24 — Future Development

This document is the roadmap of concrete feature ideas the merged Headway
could pursue beyond the current implementation plan (A–Y). Items are
grouped by pillar (READ / RESEARCH / WRITE) and infrastructure, with
rough effort classes.

The implementation-plan folder is the *committed* roadmap of phases. This
doc is the *speculative* longer-list, organized by impact.

---

## Current limitations (post-merger snapshot)

To frame the roadmap, here's what's still rough:

### Pre-Phase-G (single-file)

- 26 000 lines in one `index.html` — refactor in progress as Phase G
- No tests
- Mutable globals
- No TypeScript
- Bundler-less; everything from CDN

### ThesisCraft legacy issues (fixed in merger)

| Issue | Fix |
|---|---|
| Streaming endpoint missing `apiKey` | Phase O fixes |
| `writingStyle` never used in prompts | Phase O injects |
| PDF import via `FileReader.readAsText` (broken) | Phase M uses real PDF.js extraction |
| Exercise responses never persisted | Phase P adds IDB persistence |
| `relatedArticleIds` had no UI | Phase Q adds Citation Picker |
| Hashtag XSS in feed | Phase G replaces `dangerouslySetInnerHTML` |
| Notification schedule decorative | Phase L removes the fake UI; Phase Y adds real notifications |
| `feedbackLogs` exported but not imported | Phase H+I unified envelope handles all stores |
| localStorage 5-10MB cap | Phase G migrates to IDB / Dexie / OPFS |
| Whole-library prompts fail at >30 articles | Phase L caches + project-scoped feedback narrows context |

### Cross-cutting

- Discovery cost (~14 calls per search) cut to ~3-5 in Phase L (caching),
  but still expensive at scale; Phase X's optional embeddings would
  reduce further.
- Drive sync envelope grows as new stores are added; Phase U adds per-
  store delta sync.
- No accessibility audit yet.
- Service worker has no push notifications wired up (placeholder code only).

---

## Short-term (≤ 1 month each)

### READ

- **Highlights + notes on chapter text** — select a passage, color-code,
  add a sticky note. Today PDF supports highlights but reading mode does not.
- **Full-text search across sources** (lunr.js) — Phase T delivers.
- **Reading position memory** per chapter — auto-restore scroll on
  re-open.
- **Continuous reading flow** — auto-advance to next chapter on scroll
  past end.
- **Adjustable typography** — font, size, line-height, dark/light/sepia
  themes. Phase T delivers.
- **Word definitions on tap** — Wiktionary/WordsAPI + context-aware AI
  explanation.

### RESEARCH

- **Library Source detail enhancements** — show "where I cited this" map
  (links to project sections that cite this source).
- **Discovery batch retry** — if a Perplexity call fails mid-batch,
  retry just that query rather than aborting.
- **Discovery export to BibTeX** — bulk export selected results as a
  pre-citation BibTeX bundle.
- **DOI verification badge** — auto-flag results without verified DOI as
  "may be hallucinated" using CrossRef.
- **Saved query library** — name a query, run it again on demand or
  on a schedule.

### WRITE

- **Section status workflow** — visual transitions between
  not_started → in_progress → draft → review → final with celebrations.
- **Per-section word target editor** — drag a slider in the outline to
  rebalance targets across sections.
- **Outline reordering** — drag-and-drop within siblings (Phase O F/U).
- **Markdown editor upgrade** — TipTap / Lexical with slash commands,
  `/cite`, footnotes, math (Phase O F/U).
- **Confetti respect prefers-reduced-motion** — accessibility.
- **Streak across all projects** — current streak is per-project; offer
  a global option.

### Infrastructure

- **Storage quota awareness** — warn when IDB approaches limit
- **Local telemetry log** — errors in IDB, exportable for debugging
- **Lazy-load PDF.js** (~1.2 MB always loaded today)
- **Service worker push notifications wired** — not just a placeholder

---

## Medium-term (1–3 months)

### READ

- **Spaced repetition** (Anki SM-2 algorithm) for flashcards (Phase T).
- **Higher-quality image models** — DALL·E 3, Midjourney, Imagen 3, FLUX.
- **Writeup audio narration** — read deep-dive writeups via TTS.
- **Feed export to Twitter/X** — one-click "post this insight to my X".
- **Chronological feed timeline across all sources** — see all your
  feeds for the past month in one stream.
- **Personality customization** — user-defined voice prompts; "create
  your own personality".
- **Tesseract WASM fallback** — local OCR when no AI provider is
  available.
- **Concurrent page extraction** — batch OCR, 4 pages parallel.
- **Diff view in OCR review** — PDF.js text vs AI text side-by-side.
- **Better EPUB handling** — OPF spine, embedded covers, metadata.
- **MOBI/AZW/DOCX/TXT/URL/audiobook import**.

### RESEARCH

- **Pre-computed daily digest** — overnight job runs Discovery once,
  surfaces 5 best results in a dashboard, no per-click API burn (Phase X).
- **Semantic search in library** — Phase X optional embeddings.
- **Citation graph visualization** — force-directed (Phase W).
- **Related work suggestions** — given a section, propose 5 sources not
  yet cited that the AI thinks would strengthen the argument.
- **Author profiles** — auto-pull author info from OpenAlex when a source
  has a DOI.

### WRITE

- **Draft history / versioning** (Phase O F/U) — keep last 5 AI drafts
  per section.
- **Diff merge for AI drafts** — paragraph-level "use this", "skip this"
  picker.
- **Per-section voice memo recording** — record yourself, transcribe via
  Whisper, get an AI-suggested outline back.
- **Live word count goal** — visual target indicator: where you'd be at
  the end of a paragraph at this rate.
- **Co-author mode** — split each section into "claim" / "evidence" /
  "reasoning" pieces (extends argument_builder exercise into the editor).

### TTS / audio

- **Whisper for per-word timestamps** — word-by-word highlighting during
  playback (Phase V).
- **Background generation queue** — pre-generate next 3 chapters' audio
  while reading current.
- **Per-chapter voice selection** — different voice per chapter / source.
- **SSML support** — pauses, emphasis, pronunciation hints.
- **Crossfade between chapters** during sequential playback.
- **Variable speed without pitch shift** (WSOLA / phase vocoder) — Phase V.
- **Resume from last audio position** per chapter.
- **Offline-only TTS** — Kokoro / Piper WASM (Phase V).

### Cloud / sync

- **Real-time sync via WebSocket** — Supabase Realtime, Ably, etc.
- **CRDT for collaborative edits** — Yjs per chapter / per section
  (Phase U).
- **Encrypted sync** — libsodium WASM worker (Phase U).
- **Multi-cloud** — Dropbox, OneDrive, iCloud Drive (Phase U).
- **Auto-sync on idle** — debounced 30s after last write.

### Library

- **Folders/collections** for organizing sources
- **Multi-tag filtering** with AND/OR/NOT
- **Sort options** (recently added, recently read, alphabetical,
  completion %)
- **Streak heatmap calendar** (GitHub-contribution style)

### DevOps / quality

- **TypeScript strict** end-to-end (Phase G)
- **Vitest unit tests** (Phase G)
- **Playwright e2e tests** on fixture sources/projects (Phase G)
- **Sentry-compatible opt-in error logging** (Phase G)

### Accessibility

- Full keyboard navigation
- ARIA labels on all icon buttons
- High-contrast mode
- Screen reader testing

---

## Long-term (3–12 months) — these often imply a new phase

### Native apps

- iOS app via Capacitor (Phase Y)
- Android app via Capacitor (Phase Y)
- Native widgets (today's chapter, today's exercise, streak)

### Browser extensions

- Right-click → "Send to Headway" for any web page
- Inline highlighter that syncs to Source highlights
- "Search in Headway" omnibox keyword

### Internationalization

- UI translation (English, Slovenian, German, Spanish, French, ...)
- Per-language UI orientation (RTL for Arabic, Hebrew)
- Locale-aware date/number formatting
- AI prompts translated for non-English content

### Multi-user (shared / collaborative)

- Workspaces shared with collaborators (advisor + student)
- Read-only share link for a project (supervisor reviews drafts)
- Comment threading on sections
- Version history with diff view

### Premium AI

- Claude Opus 4 / 4.5 integration
- GPT-4 Turbo integration
- Local LLM (Llama / Mistral) via WebLLM for offline AI
- Hybrid: cheap model for first pass, expensive for polish

### Knowledge synthesis

- "Compose article from notes" — given project's sections + linked
  sources, AI proposes a draft article.
- "Question my hypothesis" — paste H1, AI argues for and against using
  library sources.
- "Find counter-evidence" — given a claim in a draft, search library
  + Discovery for sources that disagree.

### Print / export

- Generate a PDF of a project draft (typeset, with bibliography)
- LaTeX export of a project (chapters / sections / citations / bibliography)
- DOCX export with track changes
- E-pub export of a notes collection

### Character chat

- Chat with the *author* of a source ("What did Harari mean by…?")
- Chat with two authors at once for cross-pollination

---

## Wishlist (Phase Y / unlimited)

23+ sub-features categorized in Phase Y:

1. Native iOS / Android apps (Capacitor)
2. Browser extensions (Chrome / Firefox)
3. Internationalization (5+ languages)
4. WCAG 2.1 AA accessibility audit + fixes
5. Design system + component library
6. Multi-user / workspaces / collaboration
7. Premium AI provider tier (Claude, GPT-4, local LLM)
8. Local LLM via WebLLM for offline AI
9. Analytics dashboard (per-project, per-source, time-spent)
10. Print-to-Headway service (mail order; physical book → digital library)
11. Character chat (talk to authors)
12. Voice cloning (Lazybird custom voice training)
13. Real-time collaborative reading (book club mode)
14. Adaptive difficulty for quizzes (per-chapter SM-2)
15. Reading speed tracker + projections
16. Goal setting + progress reports
17. Pomodoro mode for reading sessions
18. Daily summary email / push notification
19. Calendar integration (when to read what)
20. Marketplace for shared decks / outlines / personalities
21. Public profile (optional) — share progress, books, personality remixes
22. AI tutor mode (long-running thread that knows your reading history)
23. Advanced metrics: comprehension rate, retention curve, knowledge graph
    growth over time

---

## Continue reading

- The committed phased roadmap: `implementation-plan/00-overview.md`
- Architecture for the rebuild: [`02-architecture.md`](02-architecture.md)
- Rebuild blueprint: [`25-rebuild-blueprint.md`](25-rebuild-blueprint.md)
