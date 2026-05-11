# 01 — Product Overview

## What Headway is

A **personal knowledge platform** that turns books, PDFs, articles, web
pages, and notes into a unified workspace for **reading, researching, and
writing**. The user's library lives entirely in IndexedDB and (optionally)
in their own Google Drive appData folder. There is no backend that holds
user data.

Headway has evolved through a merger of two earlier apps:

- **Headway / ChapterWise** — single-file PWA (`index.html`, ~26 000
  lines pre-Phase-G), focused on book consumption with 11 reading modes
  (Read, Listen, Ask, Quiz, Cards, Teach, Socratic, Mind Map, Feed,
  Video), TTS, PDF viewer, Drive sync.
- **ThesisCraft** — Next.js PWA, focused on academic writing, with
  Discovery (Perplexity-based article search) and a Writing Hub (outline
  editor + streaming AI drafts + 6 interactive exercise types).

The merged app keeps the **Headway** name and reorganizes around three
pillars (READ, RESEARCH, WRITE), all sharing one library and one Drive
sync.

The codebase historically used two interchangeable names — **ChapterWise**
(IDB database name `ChapterWiseDB`, manifest, service worker cache name)
and **Headway** (the repo / project name). Phase G's rebuild renames
internally to `Headway` consistently, but legacy data continues to work.

---

## Who it is for

A single power-user (the developer's own library) who wants to:

1. Drop in their own EPUB / PDF library (textbooks, papers, novels, blog
   posts, notes).
2. Have AI split, clean, and structure each source into chapters.
3. Choose how to interact with each chapter: read, listen, quiz, drill,
   teach back, mind-map, generate a viral social feed, generate a TikTok
   video.
4. Do **academic-grade research**: discover new articles via Perplexity,
   bias future searches with feedback, build a citation library, generate
   a bibliography.
5. **Write structured long-form content** with a project outline, AI
   draft generation per section, and writing exercises that practise
   specific skills.
6. Work across **multiple research/writing projects** — one for a
   master's thesis, one for a side article, one for a personal book —
   each with its own outline, hypotheses, keywords, and citations.
7. Sync the whole library + projects across devices through their own
   Google Drive account, with no third-party server in between.

---

## The three pillars

### READ — consume

Library + 11 reading modes (book-level and chapter-level), all generating
content from `chapters` rows.

| Tab | What it does |
|-----|--------------|
| 📖 Read | Clean HTML reading view with markdown rendering |
| 🎧 Listen | TTS via three providers (browser / Lazybird / Google Cloud) |
| 💬 Ask | In-chapter chat with the AI grounded in the chapter text |
| 💡 Summary | 3–5 key concepts + difficulty rating + reading time |
| ❓ Quiz | 6 different quiz mode variants |
| 🃏 Cards | Flippable flashcards with front/back |
| 🎓 Teach | Feynman teach-back: user explains, AI grades |
| 🤔 Socratic | Multi-turn Socratic dialogue |
| 🧠 Mind Map | Hierarchical SVG mind map with branches |
| 📱 Feed | 20 social-media-style posts with 12 personalities + AI-generated images |
| 🎬 Video | Vadoo AI viral short-form video |

Plus book/source-level features: book mind map, book feed, multi-book
feed, cross-source feed, learning hub, batch audio, chapter review.

### RESEARCH — discover

Discovery view (top-level pillar) with the 3-step pipeline:

1. **Gemini** optimizes 3 search queries from project keywords + last 20
   feedback log entries
2. **Perplexity Sonar** searches academic databases (parallel × 3)
3. **Gemini** analyzes each unique result for relevance, key concepts,
   why-relevant sentence, hypothesis match

Three sub-tabs (Latest / Favorites / History) with feedback actions
(heart, rate, dismiss, add to library, cite). Feedback writes
`research_feedback` rows that bias the next search via Step 1's prompt.

24-hour Perplexity caching and cross-batch analysis caching reduce cost
~80 % vs ThesisCraft's pattern.

### WRITE — produce

Writing Hub (top-level pillar) with three screens:

1. **Dashboard** — overall progress ring, today's exercise, recent
   activity, motivational tip
2. **Outline tree** — collapsible 2-level tree of project sections with
   status dots, per-section progress bars, drag-reorder
3. **Section Editor** — Markdown editor with auto-save, streaming AI
   draft generation (NDJSON), inline citation picker, exercise launcher

Six interactive writing exercise types (`fill_blanks`, `expand_outline`,
`rewrite_ai`, `connect_concepts`, `citation_practice`, `argument_builder`)
with persistence (Headway fix vs TC's discarded responses).

Citation library + BibTeX export + Zotero/Mendeley BibTeX import + DOI
lookup + auto-bibliography rendering.

### Multi-project

A user can have any number of independent projects:

- Create blank, from a preset (thesis / article / book / blank), or from
  a JSON import file with full structure (outline, hypotheses, keywords,
  titles, subtitles).
- Switch active project from a top-bar dropdown.
- The active project drives Discovery (its keywords + feedback) and the
  Writing Hub (its sections).
- Library is global; citations link library Sources to a specific
  project's sections.
- **No-project mode**: everything works without a project for users who
  just want to read.

---

## Library (READ-pillar surface)

- **Drag-in upload** of EPUB / PDF / URL / Note (auto-detected, queued).
- **Batch import queue** with per-file status (pending → extracting →
  processing → ready → done) and per-file retry.
- **Project import**: `chapterwise-import.json` with `type: "project"`
  loads a full project structure.
- **Tags** on sources, with a tag-filter row.
- **Kind filter** (post-Phase-I): All / Books / Articles / URLs / Notes.
- **Multi-select mode** for batch-tag, batch-feed, batch-chat actions.
- **Daily card** that surfaces "today's chapter" based on streak data.
- **Stats**: streak counter, total chapters read, etc.
- **Local import banner** that auto-appears when a `chapterwise-import.json`
  file is present in the project root.
- **Cover thumbnails** auto-rendered from PDF page 1 on import.
- **Cover regeneration** via AI image (Gemini image-out or Bonkers/Merlin).

---

## Audio

- 3 TTS backends: browser SpeechSynthesis, Lazybird AI, Google Cloud TTS.
- **Persistent mini-player** survives navigation, integrates with
  `MediaSession` (iOS lockscreen, Android notification).
- **Sequential book playback** (auto-advance through chapters).
- **MP3 export** per chapter.
- **Combined book download** (all chapters merged into one MP3).
- **Batch generate** all chapter audio with progress UI.

---

## Cloud / sync

- **Google Drive appDataFolder** sync (sources + chapters + progress +
  generated + projects + citations + research feedback + custom prompts +
  API keys, all via the user's own Drive).
- **Three-way sync** (download → merge → upload).
- **Memory-safe streaming upload** for libraries with hundreds of MB of
  base64-encoded PDFs (works on iOS Safari with 300–500 MB heap limit).
- **Disconnect** revokes the OAuth token.
- **Per-store delta sync** (post-Phase-U) for very large libraries.

---

## Import / export

- **Local file import** (`chapterwise-import.json` auto-detected on load)
  — accepts library import, project import, or both in one envelope.
- **File picker import** (Settings → Import JSON File).
- **Paste JSON import** (Settings → Paste JSON, for cowork sessions).
- **Idempotent re-import** (upsert by ID).
- **Drive upload** of an import package.
- **Export all data** as a single JSON file.
- **Export project** as JSON (structure + citations + sections).
- **Export bibliography** as BibTeX, RIS, or CSL-JSON.

---

## AI providers

A **unified `callAI`** dispatcher routes to one of:

- **Google Gemini** (own API key)
- **Merlin AI** (email/password Firebase auth → SSE stream)
- **Junia AI** (bearer token)
- **DocAnalyzer.ai** (upload-then-chat document model)
- **Perplexity Sonar** (academic search; new in Phase K)

See [`16-ai-providers.md`](16-ai-providers.md).

---

## Image, video, streaming

- **Image generation**: Gemini 2.5 image-out models (auto-detected via
  models endpoint), Bonkers via Merlin.
- **Video generation**: Vadoo AI for vertical short-form videos (6 viral
  personas, per-duration character-limit enforcement).
- **NDJSON streaming**: AI draft generation in the Writing Hub (Phase O,
  see [`33-streaming-ai-and-ndjson.md`](33-streaming-ai-and-ndjson.md)).

---

## PDF viewer

- Scroll mode (Adobe-style)
- Slide mode (one page at a time)
- Rotation persistence (per page)
- Zoom (in/out/fit-width)
- Highlighter (multiple colors, with opacity control)
- Pen tool (freehand drawing)
- Save-to-PDF with annotations baked in (jsPDF)

---

## Why one HTML file (pre-Phase-G)

Original Headway chose a single-file PWA so:

- It can be hosted on any static host (Vercel here, but Netlify/CF/Pages
  all work).
- The user can save the page locally and run it offline through `file://`.
- There is no build step, no bundler, no CI complexity.
- The service worker can cache it as one entry.

The cost was enormous: 26 000 lines in one file, no module boundaries,
every function global, mutable state at module scope.

---

## Why a modular rebuild (Phase G)

The merger doubled the feature surface (added Discovery, Writing Hub,
Citations, multi-project). Continuing in a single file would have made
the codebase unreviewable. **Phase G converts to TypeScript + Vite +
feature-sliced folders + Web Workers + OPFS** as the foundation for all
subsequent phases (H–Y).

The static-host story is preserved — `vite build` produces a folder of
static assets that any static host can serve. PWA offline behaviour is
maintained via Workbox-generated service worker.

See [`02-architecture.md`](02-architecture.md) for the new structure and
[`25-rebuild-blueprint.md`](25-rebuild-blueprint.md) for the design
principles.

---

## Key design decisions (post-merger)

1. **No backend for user data.** Everything is IDB + the user's Drive.
2. **Bring-your-own API keys.** The user pays providers directly. The app
   stores keys in IDB and syncs them via Drive.
3. **Cache-aggressive AI output.** Every AI generation is keyed in the
   `generated` IDB store and reused. Regeneration is explicit.
4. **CDN scripts only** (pre-Phase-G); **vendored deps** (post-Phase-G).
5. **Idempotent imports.** Same ID overwrites; same import file can be
   re-applied any number of times safely.
6. **iOS-first audio** with user-gesture unlock, `visibilitychange` sync,
   `MediaSession` lockscreen integration.
7. **Multi-project, JSON-importable.** A project's structure, hypotheses,
   keywords, and section outline can be imported in one JSON file.
8. **Pillared UI** — Library, Discovery, Writing as siblings — but reading
   modes are still per-source actions, and citations cross the boundary
   between library and projects.

---

## Key trade-offs

- **All-in-one scope** even bigger now (3 pillars × 11 reading modes ×
  multi-project). The plugin contract for AI/TTS/image/sync providers
  helps but doesn't fully tame complexity.
- **Phase G is foundational.** Until it ships, all merger-specific
  features (H–Y) are blocked.
- **iOS Safari memory ceiling drives a lot of design.** See the streaming
  Drive uploader, the OPFS-backed PDF storage, and the sequential-only
  audio singleton.
- **AI cost discipline.** Discovery's 3-step pipeline could be expensive
  without the 24h cache; Headway's caching cuts cost ~80 % vs TC's
  pattern but discovery still consumes more than reading.
- **Browser-only TTS for offline.** Lazybird and Google Cloud TTS require
  internet. Browser fallback is intentionally simple.

Continue to [`02-architecture.md`](02-architecture.md).
