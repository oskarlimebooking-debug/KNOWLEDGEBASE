# 26 — Projects & Research Workspaces

A **Project** in Headway is a self-contained research or writing workspace.
It owns an outline (hierarchical sections), a target word count, optional
hypotheses, search keywords, a writing style, and a list of linked sources
and citations. It is the top-level container for the RESEARCH and WRITE
pillars of the merged app.

> Implemented in Phase H (`implementation-plan/phase-h-multi-project-workspaces.md`).

---

## Why projects exist

Pre-merger Headway had no concept of "what am I working towards?" — it was
a pure consumption library: one big bag of books with reading modes on top.
ThesisCraft brought the opposite shape: one tightly-scoped writing workspace
hard-coded to a single thesis.

The merged app generalizes ThesisCraft's idea into a **multi-project model**:

- A user can create any number of independent projects.
- Each project has its own outline, hypotheses, keywords, style.
- The user can switch the active project from a top-bar dropdown.
- The library and reading modes still work in **no-project mode** for users
  who never create one (full backward-compatibility with pre-merger UX).

Projects unlock the new pillars:
- **Discovery** searches with the *active project's* keywords + feedback.
- **Writing Hub** edits the *active project's* sections.
- **Citations** link library Sources to the *active project's* sections.

---

## Data model

### `projects` IDB store

```ts
interface Project {
  id: string;                  // "proj_<ms>"
  title: string;
  kind: 'thesis' | 'article' | 'book' | 'custom';
  language: string;            // BCP-47, e.g. "en", "sl"
  totalWordTarget: number;     // sum of leaf sections' targetWords
  hypotheses: string[];        // optional, e.g. ["H1: ...", "H2: ..."]
  keywords: string[];          // used by Discovery
  writingStyle: string;        // free-form, fed into draft prompts
  description?: string;
  createdAt: string;           // ISO
  updatedAt: string;           // ISO
  archived?: boolean;
}
```

### `project_sections` IDB store

```ts
interface ProjectSection {
  id: string;                  // hierarchical path, e.g. "1", "2", "2.1"
  projectId: string;
  parentId: string | null;     // null for top-level
  number: string;              // display number, e.g. "2.1"
  title: string;
  description?: string;
  order: number;               // 1-based among siblings
  targetWords: number;         // 0 for parent chapters
  status: 'not_started' | 'in_progress' | 'draft' | 'review' | 'final';
  content: string;             // user's writing (Markdown after Phase O)
  aiDraft: string;             // last accepted AI-generated draft
  wordCount: number;           // recomputed on save
  lastEdited?: string;         // ISO
  relatedSourceIds?: string[]; // links to Sources (Phase Q expands UI)
  relatedChapterIds?: string[];// links to specific chapters of multi-chapter sources
}
```

Section IDs are hierarchical strings (mirrors ThesisCraft convention) so
sorting is naturally lexical and the parent of `"2.1"` is `"2"`.

### `settings` extensions

| Key | Type | Default | Meaning |
|---|---|---|---|
| `activeProjectId` | string \| null | `null` | Currently selected project; `null` = no-project mode |
| `prompt_writingDraft` | string | template | Override the generate-draft prompt |
| `prompt_exerciseGen` | string | template | Override exercise generator |

---

## Project switcher

Lives in the top nav next to the Drive sync menu.

```
[ Library ] [ Discovery ] [ Writing ]   ───   [ ⚙ Project: Thesis ▾ ]
                                                         │
                                              ┌──────────┴──────────┐
                                              │ My MA Thesis  ✓     │
                                              │ Side article (2026) │
                                              │ ─────────────────── │
                                              │ + New project       │
                                              │ ↑ Import from JSON  │
                                              │ Manage projects…    │
                                              └─────────────────────┘
```

Switching the active project:
1. Calls `setSetting('activeProjectId', projId)`.
2. Re-renders Discovery (re-reads `keywords`), Writing Hub (re-reads
   sections), Settings UI panels that refer to the active project.
3. Library is **not** project-scoped — it remains global. Citations and
   `relatedSourceIds` are what tie a library Source to a particular project.

---

## Creating a project

Three paths:

### 1. From scratch (UI)

`+ New project` opens a modal with three preset shapes:

- **Empty thesis** — IMRaD-style 6-chapter outline scaffold (22 leaf sections).
- **Empty article** — 5-section IMRaD (Intro / Methods / Results / Discussion / Conclusion).
- **Empty book outline** — 10 untitled chapters, no targets.
- **Blank** — title only, no sections.

The user picks a title, kind, language, and optional keywords. The seed
sections are written to `project_sections` with hierarchical IDs.

### 2. From JSON import

The user pastes or selects a JSON file with this shape (see
[`22-import-file-format.md`](22-import-file-format.md) for the unified
envelope):

```jsonc
{
  "version": 1,
  "type": "project",                 // disambiguator vs library import
  "project": {
    "id": "proj_1714720000000",
    "title": "Job Crafting in Sales Performance",
    "kind": "thesis",
    "language": "en",
    "totalWordTarget": 9000,
    "hypotheses": [
      "H1: Job crafting positively influences intrinsic work motivation",
      "H2: Job crafting positively influences sales performance",
      "H3: Intrinsic motivation mediates job crafting → sales performance",
      "H4: Autonomy moderates job crafting → motivation",
      "H5: Sales experience moderates job crafting → performance"
    ],
    "keywords": [
      "job crafting", "work motivation", "sales performance",
      "self-determination theory", "job demands-resources"
    ],
    "writingStyle": "academic",
    "createdAt": "2026-05-03T12:00:00.000Z"
  },
  "sections": [
    { "id": "1",   "parentId": null, "number": "1",   "title": "Introduction",            "targetWords": 500, "order": 1 },
    { "id": "2",   "parentId": null, "number": "2",   "title": "Job Crafting",            "targetWords": 0,   "order": 2 },
    { "id": "2.1", "parentId": "2",  "number": "2.1", "title": "Definition",              "targetWords": 800, "order": 1 },
    { "id": "2.2", "parentId": "2",  "number": "2.2", "title": "Job Demands-Resources",   "targetWords": 700, "order": 2 }
  ]
}
```

The import is **idempotent** by `project.id` — re-importing the same JSON
upserts. If `project.id` is missing the importer assigns a new
`proj_<Date.now()>`.

This is the **primary path** for the user-confirmed requirement: "uvoziš
ustrezen json fajl s celotno strukturo, ključnimi besdedami, naslovi in
podnaslovi".

### 3. From a library Source

(Phase Q + later) — given a long PDF book or article, the user can pick
"Spawn project from this source" and the AI generates a research outline
with the source as the seed reading. The Source is automatically linked to
all leaf sections.

---

## No-project mode (backward compat)

Headway must keep working for users who never create a project:

- **Library**, **reading modes**, **TTS**, **PDF viewer**, **Drive sync**
  all work unchanged.
- **Discovery** still works but uses a global `searchKeywords` setting (the
  pre-merger ThesisCraft default keyword list) and a global feedback log.
- **Writing Hub** is hidden from the top nav until the user creates or
  imports a project. A small "Create your first project" CTA replaces it.
- The badge on the project switcher shows "No project" instead of a name.

The implementation rule: anywhere code reads `activeProjectId`, it must
gracefully degrade when the value is `null`.

---

## Project hub view

Optional dashboard accessible by tapping the project name in the switcher
("Manage projects…" → list of projects → tap one):

- Title + kind + creation date + total words / target
- Progress ring (sum of leaf wordCounts / totalWordTarget)
- Day streak across this project's sections
- Quick stats: # sections completed, # citations, # linked sources, today's exercise
- Buttons: Edit metadata · Export project (JSON + Markdown) · Archive · Delete

Phase H delivers a minimal version (just the metadata editor + export).
Phase X expands it into a "research dashboard" with hypothesis tracking
and evidence map.

---

## Drive sync

Both stores (`projects`, `project_sections`) are added to the Drive sync
envelope alongside the existing five (`books`, `chapters`, `progress`,
`generated`, `settings`). See [`17-drive-sync.md`](17-drive-sync.md).

Merge rule: last-write-wins per `id`, using `updatedAt` on projects and
`lastEdited` on sections. `settings.activeProjectId` is **device-local**
(not synced) so different devices can have different active projects.

---

## Service worker pass-through

`chapterwise-import.json` is already in the SW pass-through allowlist for
auto-detection. Project JSON imports go through the same banner detection,
so no SW change is needed.

---

## Migration from ThesisCraft

A one-shot importer maps a ThesisCraft `thesiscraft-backup-<date>.json`
into the new model:

- `articles` → library `sources` with `kind: 'article'` (Phase I generalization)
- `thesisSections` → one `project` (kind: `thesis`, hard-code its hypotheses)
  + 22 `project_sections`
- `searchResults` → `discovery_results` store (Phase L)
- `feedbackLogs` → `research_feedback` store (Phase L)
- `feedCards` → `generated` store with `type: 'feed'` keyed to the project
- `exercises` → `writing_exercises` store (Phase P)
- `settings` (subset) merged into Headway settings, namespaced where they
  collide (`thesiscraft_searchKeywords` → project's `keywords`)

---

## Continue reading

- Discovery uses a project's `keywords` + feedback: [`27-discovery-module.md`](27-discovery-module.md).
- Writing Hub edits a project's sections: [`28-writing-hub.md`](28-writing-hub.md).
- Citations link sources to sections: [`30-citations-and-sources.md`](30-citations-and-sources.md).
- Source generalization (Book → Source): [`32-source-vs-book.md`](32-source-vs-book.md).
- The unified import format: [`22-import-file-format.md`](22-import-file-format.md).
