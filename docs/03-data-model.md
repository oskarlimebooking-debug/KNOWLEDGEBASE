# 03 — Data Model

All persistence is browser-local IndexedDB plus optional sync-to-Drive of
a single JSON snapshot.

This document covers the **post-merger** data model with all 12 stores.
Pre-Phase-I had 5 (`books`, `chapters`, `progress`, `generated`,
`settings`); Phase H added `projects` and `project_sections`; Phase I
renamed `books` to `sources` (see [`32-source-vs-book.md`](32-source-vs-book.md));
Phase L added 3 discovery stores; Phases P–Q added 2 writing stores.

---

## Database

`indexedDB.open('ChapterWiseDB', 2)` (post-Phase-I; v1 was the legacy
shape with `books` store).

Twelve object stores (post-Phase-Q):

| Store | Indexed by | Purpose | Phase |
|---|---|---|---|
| `sources` | `id`, `addedAt`, `kind` | Library entries (books, articles, urls, notes) | Phase I (was `books`) |
| `chapters` | `id`, `sourceId` | Chapter rows for each source | A (renamed) |
| `progress` | `id`, `sourceId`, `date` | Per-chapter completion + streaks | A |
| `generated` | `id`, `chapterId`, `type` | Cache for every AI-produced artefact | A |
| `settings` | `key` | Key-value config + API keys + custom prompts | A |
| `projects` | `id`, `createdAt` | Research/writing projects | H |
| `project_sections` | `id`, `projectId`, `parentId`, `order` | Hierarchical outline rows | H |
| `discovery_results` | `id`, `projectId`, `batchId`, `dateFound` | Discovery findings | L |
| `discovery_cache` | `id` | 24h Perplexity result cache | L |
| `research_feedback` | `id`, `projectId`, `timestamp` | Adaptive search bias log | L |
| `writing_exercises` | `id`, `projectId`, `sectionId`, `completed` | Writing exercise instances | P |
| `citations` | `id`, `projectId`, `sectionId`, `sourceId` | Source ↔ section bindings | Q |

Schemas use Dexie typed migrations (post-Phase-G). Pre-Phase-G used hand-
rolled wrapper helpers.

---

## Wrapper helpers (post-Phase-G via Dexie)

```ts
import { db } from '@/data/db';

await db.sources.put(source);
await db.sources.get(id);
await db.sources.where('kind').equals('article').toArray();
await db.chapters.where('sourceId').equals(id).toArray();
await db.progress.where('date').between(start, end).toArray();
```

Pre-Phase-G equivalent (kept for legacy reference):

```js
async function dbPut(storeName, data)
async function dbGet(storeName, key)
async function dbGetAll(storeName)
async function dbGetByIndex(storeName, indexName, value)
async function dbDelete(storeName, key)
async function getSetting(key)
async function setSetting(key, value)
```

---

## `sources` schema (renamed from `books` in Phase I)

```ts
interface Source {
  id: string;                  // 'src_<timestamp_ms>' (was 'book_<ts>')
  kind: 'book' | 'article' | 'url' | 'note';
  title: string;
  authors: string[];           // (was string in Book)
  year?: number;
  language?: string;           // BCP-47
  description?: string;
  tags: string[];
  totalChapters: number;
  addedAt: string;             // ISO
  updatedAt: string;

  // Binary
  pdfData?: ArrayBuffer;       // raw bytes locally
  _pdfDataIsBase64?: boolean;  // flagged when serialized for sync
  _pdfDataExcluded?: boolean;  // flagged when sync skips binary
  coverImage?: string;         // data: URL JPEG

  // Per-kind metadata
  doi?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  isbn?: string;
  url?: string;
  fetchedAt?: string;
  noteContent?: string;        // for kind:'note', body lives here
  _unverified?: boolean;       // Discovery imports without DOI verification
}
```

`pdfData` stored as a real `ArrayBuffer` locally; only base64-encoded when
serialized for sync or import. The `arrayBufferToBase64` helper chunks at
8 KB to avoid quadratic string concat on iOS.

Post-Phase-G: PDFs migrate to OPFS (`Origin Private File System`) and
`pdfData` becomes a reference (file path or handle), eliminating the
heap inflation problem entirely. See [`02-architecture.md`](02-architecture.md).

---

## `chapters` schema

```ts
interface Chapter {
  id: string;                  // '<sourceId>_ch_<index>' (was '<bookId>_ch_<i>')
  sourceId: string;            // (was bookId)
  title: string;
  number: number;              // 1-based display number
  index: number;               // 0-based ordering
  content: string;             // primary text body
  text: string;                // legacy mirror — populate identical to content
  difficulty?: number;         // optional, set by summary generator
  formattedHtml?: string;      // cached formatTextHtml output
}
```

The `content`/`text` duplication is historical. Generators read `content`.
Backup/import writers should populate **both** with identical text. Phase G
proposes deprecating `text` (one major version of dual-write, then drop).

---

## `progress` schema

```ts
interface Progress {
  id: string;                  // chapterId — 1:1
  sourceId: string;            // (was bookId)
  chapterId: string;
  completed: boolean;
  completedAt?: string;        // ISO
  date: string;                // YYYY-MM-DD for streak calculation
}
```

Streak computed from distinct `date` values across all entries.

---

## `generated` schema (the AI cache)

A single store holds every AI artefact. Examples:

| Feature | `id` pattern | `type` |
|---|---|---|
| Summary | `summary_<chapterId>` | `summary` |
| Quiz | `quiz_<chapterId>` | `quiz` |
| Quiz scores | `quiz_scores_<chapterId>` | `quiz_scores` |
| Flashcards | `flashcards_<chapterId>` | `flashcards` |
| Teach-back grade | `teachback_<chapterId>` | `teachback` |
| Mind map | `mindmap_<chapterId>` | `mindmap` |
| Source mind map | `source_mindmap_<sourceId>` | `source_mindmap` |
| Feed (chapter) | `feed_<chapterId>` | `feed` |
| Feed (source) | `source_feed_<sourceId>` | `source_feed` |
| Multi-source feed | `multi_source_feed_<sortedJoinedIds>` | `multi_source_feed` |
| Cross-source feed | `cross_<sourceCh>_to_<targetSrc>` | `cross_source_feed` |
| Lazybird audio | `lazybird_audio_<chapterId>` | `lazybird_audio` |
| Google TTS audio | `google_tts_audio_<chapterId>` | `google_tts_audio` |
| Vadoo video | `video_<chapterId>` | `video` |
| Source video | `source_video_<sourceId>_<chapterId>` | `source_video` |
| TTS-cleaned text | `tts_cleaned_<chapterId>` | `tts_cleaned` |
| Writeup | `writeup_<chapterId>_<topic>_<personality>` | `writeup` |
| Discovery analysis cache | `discovery_analysis_<sha1(title)>` | `discovery_analysis` |
| DOI lookup cache | `lookup_doi_<doi>` | `lookup_doi` |
| OpenAlex lookup cache | `lookup_openalex_<doi>` | `lookup_openalex` |
| Migration backup | `migration_backup_<date>` | `migration_backup` |
| Pending chapters (review) | `pending_chapters_<sourceId>` | `pending_chapters` |

The same store also holds:
- The chapter-review queue's `chapters` array under `pending_chapters_<sourceId>`
  while the user is editing.
- Lookup caches for DOI/OpenAlex.

---

## `settings` schema

```ts
interface Setting {
  key: string;
  value: any;
}
```

Major keys (full list in [`20-settings.md`](20-settings.md)):

```
# AI providers
apiKey                                  Gemini key
selectedModel                           chosen Gemini model id
imageProvider, imageModel               gemini | bonkers
ocrChunkSize                            words per OCR chunk
readingSpeed                            wpm

useLazybirdTts, lazybirdApiKey, lazybirdVoice
useGoogleTts, googleTtsApiKey, googleTtsVoice

aiProvider                              gemini | merlin | junia | docanalyzer | perplexity
merlinIdToken, merlinRefreshToken, merlinTokenExpiry, merlinEmail,
merlinModel, merlinWebAccess, merlinOCRMode

juniaToken, juniaCreativity, juniaPersona, juniaGpt4
docanalyzerApiKey, docanalyzerModel, docanalyzerAdherence
perplexityApiKey                        # NEW Phase K

vadooApiKey, vadooDuration, vadooVoice, vadooStyle, vadooTheme, vadooAspect

# Cloud
googleAccessToken, googleTokenExpiry, lastSyncTime

# Multi-project (Phase H)
activeProjectId                         null = no-project mode

# Discovery (Phase L)
discoveryAnalysisDepth                  'all' | 'top5'
discoveryCacheTtlH                      24
allowExpensiveDiscovery                 boolean

# Writing (Phase O–P)
writing_lastSectionId_<projectId>       last opened section per project
exercisePreferences_<projectKind>       favoured exercise types per project kind

# Citations (Phase Q)
bibliography_<projectId>                'inline' | 'end-only' | 'off'
citationStyle_<projectId>               'apa' | 'vancouver' | 'mla' | ...

# Per-chapter TTS toggles
tts_clean_lazybird_<chapterId>, tts_clean_browser_<chapterId>,
tts_clean_google_<chapterId>,
tts_describe_tables_lazybird_<chapterId>, ... etc
tts_sequential_lazybird_<chapterId>, ...
tts_model_lazybird_<chapterId>, tts_model_browser_<chapterId>

# Per-page rotation/highlights for the PDF viewer
pdf_rotation_<sourceId>_<page>
pdf_highlights_<sourceId>_<page>

# Custom prompts
prompt_chapterSplit, prompt_summary, prompt_quiz, prompt_flashcards,
prompt_teachback, prompt_formatText, prompt_ocrClean, prompt_ttsClean,
prompt_feed, prompt_sourceFeed, prompt_multiSourceFeed, prompt_writeup,
prompt_sourceWriteup, prompt_multiSourceWriteup, prompt_mindmap,
prompt_writingDraft, prompt_exerciseGen,                 # Phase O–P
prompt_discoveryQueryOptimize, prompt_discoveryAnalyze   # Phase L
```

---

## `projects` schema (Phase H)

```ts
interface Project {
  id: string;                  // 'proj_<timestamp_ms>'
  title: string;
  kind: 'thesis' | 'article' | 'book' | 'custom';
  language: string;            // BCP-47
  totalWordTarget: number;
  hypotheses: string[];
  keywords: string[];
  writingStyle: string;        // free-form, fed into draft prompts
  description?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}
```

See [`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md).

---

## `project_sections` schema (Phase H)

```ts
interface ProjectSection {
  id: string;                  // hierarchical, e.g. '1', '2', '2.1'
  projectId: string;
  parentId: string | null;
  number: string;              // display number
  title: string;
  description?: string;
  order: number;               // 1-based among siblings
  targetWords: number;         // 0 for parent chapters
  status: 'not_started' | 'in_progress' | 'draft' | 'review' | 'final';
  content: string;             // user's writing (Markdown post-Phase O)
  aiDraft: string;             // last accepted AI draft
  wordCount: number;
  lastEdited?: string;
  relatedSourceIds?: string[];
  relatedChapterIds?: string[];
}
```

Section IDs are hierarchical strings (mirrors ThesisCraft); the parent of
`"2.1"` is `"2"`. Lexical sort gives natural outline order.

---

## `discovery_results` schema (Phase L)

```ts
interface DiscoveryResult {
  id: string;                  // 'sr_<ts>_<i>_<rand>'
  projectId: string | null;    // null = no-project search
  title: string;
  authors: string;
  abstract: string;
  journal?: string;
  year?: number;
  url: string;
  pdfUrl?: string;
  relevanceScore: number;      // 0–100
  relevantConcepts: string[];
  whyRelevant: string;
  hypothesisMatches?: string[];
  isFavorite: boolean;
  rating?: number;             // 1–5
  dismissed: boolean;
  addedToLibrary: boolean;
  batchId: string;             // 'batch_<ts>_<rand>'
  dateFound: string;
}
```

See [`27-discovery-module.md`](27-discovery-module.md).

---

## `discovery_cache` schema (Phase L)

```ts
interface DiscoveryCacheEntry {
  id: string;                  // sha1(query + projectId)
  query: string;
  projectId: string | null;
  results: PerplexityRawResult[];
  cachedAt: string;
  ttl: number;                 // hours, default 24
}
```

---

## `research_feedback` schema (Phase L)

```ts
interface ResearchFeedback {
  id: string;                  // 'fb_<ts>'
  projectId: string | null;
  action: 'favorite' | 'dismiss' | 'rate' | 'add_to_library' | 'cite';
  sourceTitle: string;
  sourceAuthors?: string;
  sourceUrl?: string;
  concepts: string[];
  rating?: number;             // 1–5, only for action: 'rate'
  timestamp: string;
}
```

See [`31-research-feedback-loop.md`](31-research-feedback-loop.md).

---

## `writing_exercises` schema (Phase P)

```ts
interface WritingExercise {
  id: string;                  // 'ex_<ts>'
  projectId: string;
  sectionId: string;
  type: 'fill_blanks' | 'expand_outline' | 'rewrite_ai'
      | 'connect_concepts' | 'citation_practice' | 'argument_builder';
  prompt: string;
  hints: string[];
  sampleAnswer?: string;
  userResponse?: string;       // ✓ persisted (TC bug fix)
  aiFeedback?: string;
  completed: boolean;
  startedAt: string;
  completedAt?: string;
  hintsUsed: number;
}
```

See [`29-writing-exercises.md`](29-writing-exercises.md).

---

## `citations` schema (Phase Q)

```ts
interface Citation {
  id: string;                  // 'cit_<ts>_<rand>'
  projectId: string;
  sectionId: string;
  sourceId: string;
  chapterId?: string;
  citationKey: string;         // BibTeX-style, e.g. 'tims2012'
  snippet?: string;
  page?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
```

See [`30-citations-and-sources.md`](30-citations-and-sources.md).

---

## The sync JSON

Drive sync and the import pipeline use one envelope:

```jsonc
{
  "version": 2,                         // bumped from 1 in Phase I
  "syncedAt": "2026-05-03T12:00:00Z",
  "sources":           [...],           // pre-Phase-I name was 'books'
  "chapters":          [...],
  "progress":          [...],
  "generated":         [...],
  "settings":          { ... },
  "projects":          [...],           // Phase H
  "project_sections":  [...],           // Phase H
  "discovery_results": [...],           // Phase L
  "research_feedback": [...],           // Phase L
  "discovery_cache":   [...],           // Phase L (often skipped)
  "writing_exercises": [...],           // Phase P
  "citations":         [...]            // Phase Q
}
```

Backward-compat: a v1 reader sees `sources` as unknown and falls back to
looking for `books` (which v2 omits) — so the upload pipeline writes
both `books` and `sources` for two release cycles, then drops `books`.
See [`22-import-file-format.md`](22-import-file-format.md).

---

## ID strategy

- Sources: `src_<Date.now()>` — milliseconds give global uniqueness for
  one user; collisions only matter when two devices add a source in the
  same ms. Phase G considers UUID v7 for true global uniqueness.
- Chapters: `<sourceId>_ch_<zeroBasedIndex>` — derived from the source's
  index, predictable. **Caveat**: if you re-split, all old `generated`
  entries are orphaned because the chapter IDs change. The app does not
  garbage-collect them automatically.
- Generated: `<feature>_<targetId>` for cache invalidation by `dbDelete`.
- Projects: `proj_<Date.now()>`.
- Project sections: hierarchical strings (`"1"`, `"2.1"`, etc.).
- Discovery results: `sr_<Date.now()>_<index>_<rand6>`.
- Citations: `cit_<Date.now()>_<rand6>`.

---

## Idempotent imports

Because every entity uses a deterministic `id`, the import flow is just
`for (const x of incoming) { dbPut(store, x); }`. Re-importing the same
file is safe. See [`22-import-file-format.md`](22-import-file-format.md).

---

## Memory considerations (pre-Phase-G)

Three things drive the heaviest paths:

1. **PDF binaries** — a book can be 30 MB. The library holds them as
   `ArrayBuffer`. iOS Safari kills tabs at ~300 MB.
2. **Base64 inflation** — base64 ≈ 4/3 the binary size. So a 30 MB PDF
   becomes a ~40 MB string when prepared for sync.
3. **Full sync JSON** — for a library with N sources, peak memory during
   a naïve sync would be N × 1.33 × pdfSize. The current sync avoids this
   by streaming sources one at a time into a `Blob`.

Phase G migrates PDF binaries to OPFS. Phase U adds per-store delta sync
for very large libraries.

Continue to [`04-import-pipeline.md`](04-import-pipeline.md).
