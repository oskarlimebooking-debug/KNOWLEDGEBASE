# Headway — Complete Documentation

Headway is a personal knowledge platform that combines three pillars:
**READ** (consume books and articles with AI-driven reading modes),
**RESEARCH** (discover new academic articles and adapt to user
feedback), and **WRITE** (structured outline-based authoring with
streaming AI drafts). Multi-project: a user can create or import any
number of independent research/writing projects.

This documentation describes the merged Headway app — a fusion of the
original single-file Headway PWA (book reader, 11 reading modes, TTS,
PDF viewer, Drive sync) and the ThesisCraft Next.js app (Discovery
search via Perplexity, Writing Hub with streaming drafts, interactive
writing exercises). Phase G of the implementation plan triggers a full
TypeScript + Vite + modular rebuild as the foundation for all merged
features.

---

## Reading order

Each document targets one functional area and is written so a new
developer could rebuild the relevant subsystem from scratch.

### Foundations

| # | File | What's in it |
|---|------|--------------|
| 01 | [`01-overview.md`](01-overview.md) | What the app does, who it's for, full feature inventory across READ/RESEARCH/WRITE pillars, single-app rationale |
| 02 | [`02-architecture.md`](02-architecture.md) | High-level architecture (post-Phase-G modular), modules, data flow, render pipeline, deployment |
| 03 | [`03-data-model.md`](03-data-model.md) | IndexedDB schema (post-Phase-I `sources` + new stores), sync envelope, ID conventions |

### READ pillar (library + reading modes)

| # | File | What's in it |
|---|------|--------------|
| 04 | [`04-import-pipeline.md`](04-import-pipeline.md) | End-to-end source import flow, batch queue, project JSON import |
| 05 | [`05-ocr-and-extraction.md`](05-ocr-and-extraction.md) | PyMuPDF-equivalent JS extraction, AI-OCR (Gemini, Merlin), URL/DOI ingestion |
| 06 | [`06-chapter-detection.md`](06-chapter-detection.md) | Pattern, marker, AI-sequential, smart-word-count chapter splitters; review/edit UI |
| 07 | [`07-text-cleaning.md`](07-text-cleaning.md) | TTS cleaning, OCR cleaning, table description, AI clutter detection |
| 08 | [`08-reading-modes.md`](08-reading-modes.md) | Read, Listen, Ask, Summary, Flashcards, Teach-Back, Socratic, Mind Map, Feed, Video — Source-aware |
| 09 | [`09-quiz-modes.md`](09-quiz-modes.md) | Classic, Speed, Fill-Blanks, Devil's-Advocate, Connections, Who-Am-I |
| 10 | [`10-feed-system.md`](10-feed-system.md) | Unified personality system (12 personas: 7 Headway + 5 ThesisCraft), post structure, image generation |
| 11 | [`11-mindmap-socratic-chat.md`](11-mindmap-socratic-chat.md) | Mind maps, Socratic dialogue, in-chapter chat, batch chat |
| 12 | [`12-tts-and-listen.md`](12-tts-and-listen.md) | Browser TTS, Lazybird, Google Cloud TTS, batch generation |
| 13 | [`13-audio-player.md`](13-audio-player.md) | Persistent mini-player, MediaSession, iOS quirks, sequential auto-advance |
| 14 | [`14-vadoo-video.md`](14-vadoo-video.md) | Viral video generation: personas, script writing, polling, Vadoo proxy |
| 15 | [`15-image-generation.md`](15-image-generation.md) | Gemini image-out, Bonkers (via Merlin), feed image rendering |

### Infrastructure

| # | File | What's in it |
|---|------|--------------|
| 16 | [`16-ai-providers.md`](16-ai-providers.md) | Gemini, Merlin, Junia, DocAnalyzer, **Perplexity** — unified `callAI` |
| 17 | [`17-drive-sync.md`](17-drive-sync.md) | Google Identity Services, appDataFolder, merge, all 12 stores synced |
| 18 | [`18-pwa-and-service-worker.md`](18-pwa-and-service-worker.md) | Manifest, SW caching strategy, manual updates, push hooks |
| 19 | [`19-pdf-viewer.md`](19-pdf-viewer.md) | Scroll/slide views, rotation, highlighter, pen, save-to-PDF |
| 20 | [`20-settings.md`](20-settings.md) | Every setting key, defaults, sync behavior, project-aware preferences |
| 21 | [`21-vercel-proxies.md`](21-vercel-proxies.md) | The Vercel serverless functions: Vadoo, DocAnalyzer, **Perplexity, DOI lookup**, streaming |
| 22 | [`22-import-file-format.md`](22-import-file-format.md) | Unified envelope for sources, projects, citations, sync |
| 23 | [`23-pdf-pipeline-skill.md`](23-pdf-pipeline-skill.md) | The Claude pipeline skill in `CLAUDE.md` |

### RESEARCH pillar (post-merger)

| # | File | What's in it |
|---|------|--------------|
| 26 | [`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md) | Project entity, switcher, JSON import schema, no-project mode |
| 27 | [`27-discovery-module.md`](27-discovery-module.md) | Perplexity-based 3-step pipeline, sub-tabs, cost mitigations |
| 31 | [`31-research-feedback-loop.md`](31-research-feedback-loop.md) | Feedback log → adaptive search bias |
| 32 | [`32-source-vs-book.md`](32-source-vs-book.md) | How Source generalizes Book; data migration |

### WRITE pillar (post-merger)

| # | File | What's in it |
|---|------|--------------|
| 28 | [`28-writing-hub.md`](28-writing-hub.md) | Outline editor, streaming AI drafts, section status tracking |
| 29 | [`29-writing-exercises.md`](29-writing-exercises.md) | 6 exercise types, persistence, feedback |
| 30 | [`30-citations-and-sources.md`](30-citations-and-sources.md) | Citation entity, BibTeX export, Zotero/Mendeley import, in-text citation picker |
| 33 | [`33-streaming-ai-and-ndjson.md`](33-streaming-ai-and-ndjson.md) | NDJSON streaming protocol, Vercel route, client parser |

### Roadmap

| # | File | What's in it |
|---|------|--------------|
| 24 | [`24-future-development.md`](24-future-development.md) | Concrete short/medium/long-term feature ideas across all pillars |
| 25 | [`25-rebuild-blueprint.md`](25-rebuild-blueprint.md) | The Phase G modernization blueprint (TypeScript + Vite + modular + OPFS) |

Plus a sibling folder:

- [`implementation-plan/`](implementation-plan/00-overview.md) — phased
  build roadmap from MVP (Phase A) to unlimited-budget wishlist
  (Phase Y). 25 phases total, each shippable independently.

---

## Quick map of the codebase

```
Headway/
├── (pre-Phase-G)
│   ├── index.html          # ~26k lines: HTML + CSS + ALL app code
│   ├── sw.js
│   ├── manifest.json
│   └── api/
│       ├── docanalyzer/proxy.js
│       └── vadoo/proxy.js
│
├── (post-Phase-G)
│   ├── index.html          # thin shell, loads main bundle
│   ├── src/
│   │   ├── modes/           # one folder per reading mode
│   │   ├── pillars/
│   │   │   ├── library/     # READ pillar
│   │   │   ├── discovery/   # RESEARCH pillar
│   │   │   └── writing/     # WRITE pillar
│   │   ├── providers/       # callAI, TTS, image, sync plugins
│   │   ├── data/            # Dexie schema, migrations
│   │   ├── workers/         # OCR, chapter detection, search index
│   │   └── lib/             # pure helpers, sanitizer, markdown renderer
│   ├── api/                 # Vercel serverless: vadoo, docanalyzer, perplexity, lookup, generate-stream
│   ├── public/              # static assets, manifest, sw.js
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── CLAUDE.md                # Instructions for Claude Code (PDF pipeline skill, etc.)
└── README.md                # User-facing readme
```

If you ever need to grep for a feature, the post-Phase-G layout uses
feature-sliced folders so most work is contained in one folder.

---

## Conventions used in these docs

- Code references use `path/to/file.ts:LINE` notation. For pre-Phase-G
  references, just `index.html:LINE`.
- `dbPut('store', obj)` etc. refer to the wrapper helpers documented in
  [`03-data-model.md`](03-data-model.md). Post-Phase-G, the equivalent
  is the Dexie typed schema.
- "Setting" means a row in the `settings` IDB store keyed by string.
- "Generated" means the cache store for AI-produced JSON keyed by feature.
- "Source" replaces the older term "Book" after Phase I — see
  [`32-source-vs-book.md`](32-source-vs-book.md).
- "Project" is the new top-level container for research/writing
  workflows — see [`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md).

---

## Three pillars, one app

| Pillar | Surface | Stores it owns |
|---|---|---|
| **READ** | Library, reading modes, TTS, PDF viewer | `sources`, `chapters`, `progress`, `generated` |
| **RESEARCH** | Discovery view, sub-tabs, feedback | `discovery_results`, `discovery_cache`, `research_feedback` |
| **WRITE** | Writing Hub, outline tree, section editor, exercises | `projects`, `project_sections`, `writing_exercises`, `citations` |
| (shared) | — | `settings` |

Sync envelope, single Drive file, all 12 stores. See
[`17-drive-sync.md`](17-drive-sync.md) and [`32-source-vs-book.md`](32-source-vs-book.md)
for the migration story.
