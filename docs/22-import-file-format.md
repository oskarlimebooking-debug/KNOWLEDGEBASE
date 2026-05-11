# 22 — Import File Format

The import / export format is one **unified JSON envelope** shared
across multiple flows:

1. **Local auto-import** — drop `chapterwise-import.json` next to
   `index.html`; the app picks it up on page load.
2. **File picker** — Settings → Import JSON File.
3. **Paste** — Settings → Paste JSON.
4. **Drive sync** — `chapterwise-sync.json` in the user's appData folder.

The same envelope can carry: a library import (sources + chapters), a
project import (project + sections), a citations bundle, or any
combination thereof.

---

## Envelope (v2, post-merger)

```jsonc
{
  "version": 2,
  "syncedAt": "2026-05-03T12:00:00.000Z",
  "type": "full" | "library" | "project" | "bibliography",   // optional disambiguator

  // READ pillar
  "sources":           [ /* source rows */ ],
  "chapters":          [ /* chapter rows */ ],
  "progress":          [ /* progress rows */ ],
  "generated":         [ /* generated rows */ ],
  "settings":          { /* setting key:value */ },

  // WRITE pillar
  "projects":          [ /* project rows */ ],
  "project_sections":  [ /* section rows */ ],
  "writing_exercises": [ /* exercise rows */ ],
  "citations":         [ /* citation rows */ ],

  // RESEARCH pillar
  "discovery_results": [ /* discovery rows */ ],
  "research_feedback": [ /* feedback rows */ ],
  "discovery_cache":   [ /* (optional) cached Perplexity results */ ],

  // For single-project import shortcuts:
  "project":           { /* one Project — alternate to projects[] */ },
  "sections":          [ /* sections of `project` — alternate to project_sections[] */ ]
}
```

`version: 2` distinguishes from the pre-merger v1. The `type` hint is
informational; the importer iterates whatever stores are present.

For **single-project shortcuts**, the user can write:

```jsonc
{
  "version": 2,
  "type": "project",
  "project":  { "id": "proj_x", "title": "...", "kind": "thesis", ... },
  "sections": [ { "id": "1", "parentId": null, ... }, ... ]
}
```

The importer normalizes this to `projects: [project]` and
`project_sections: sections.map(s => ({...s, projectId: project.id}))`.

---

## Source row (Phase I+; `kind` field disambiguates)

```jsonc
{
  "id": "src_1714720000000",
  "kind": "book",                              // book | article | url | note
  "title": "Sapiens",
  "authors": ["Yuval Noah Harari"],            // array (was string in v1)
  "year": 2014,
  "language": "en",
  "tags": ["history", "anthropology"],
  "totalChapters": 20,
  "addedAt": "2024-01-15T12:00:00.000Z",
  "updatedAt": "2026-05-03T12:00:00.000Z",

  "pdfData": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago...",
  "_pdfDataIsBase64": true,
  // OR
  "_pdfDataExcluded": true,

  "coverImage": "data:image/jpeg;base64,...",

  // Per-kind metadata (optional)
  "doi": "10.xxxx/yyyy",
  "journal": "Journal of Vocational Behavior",
  "volume": "80",
  "issue": "1",
  "pages": "173-186",
  "publisher": "...",
  "isbn": "978-...",
  "url": "https://...",
  "fetchedAt": "2026-05-03T12:00:00Z",
  "noteContent": "Markdown body of a note...",
  "_unverified": false
}
```

When importing, `_pdfDataIsBase64: true` triggers
`base64ToArrayBuffer(pdfData)` to inflate it. `_pdfDataExcluded: true`
means "keep existing local pdfData if any" (for sync merges).

### Backward-compat with v1 `books`

If the envelope contains `books` (legacy) instead of `sources`, the
importer auto-coerces:

```ts
function coerceBookToSource(b: BookV1): Source {
  return {
    id: b.id.replace(/^book_/, 'src_'),
    kind: 'book',
    title: b.title,
    authors: typeof b.author === 'string' ? [b.author].filter(Boolean) : (b.author ?? []),
    year: b.year,
    tags: b.tags ?? [],
    totalChapters: b.totalChapters ?? 0,
    addedAt: b.addedAt,
    updatedAt: b.updatedAt ?? b.addedAt,
    pdfData: b.pdfData,
    _pdfDataIsBase64: b._pdfDataIsBase64,
    coverImage: b.coverImage,
  };
}
```

If both `sources` and `books` are present, `sources` wins.

---

## Chapter row

```jsonc
{
  "id": "src_1714720000000_ch_0",
  "sourceId": "src_1714720000000",       // (was bookId)
  "title": "Chapter 1: Introduction",
  "number": 1,
  "index": 0,
  "content": "Full plain-text body...",
  "text":    "Full plain-text body...",
  "difficulty": 3
}
```

**Both `content` and `text` should hold the same cleaned text.** Phase G
deprecates `text` (one major version of dual-write, then drop). Backward-
compat: legacy chapters with `bookId` instead of `sourceId` are accepted
and renamed at import time.

---

## Progress row

```jsonc
{
  "id": "src_1714720000000_ch_0",
  "sourceId": "src_1714720000000",       // (was bookId)
  "chapterId": "src_1714720000000_ch_0",
  "completed": true,
  "completedAt": "2024-01-16T09:00:00.000Z",
  "date": "2024-01-16"
}
```

---

## Generated row (cache)

```jsonc
{
  "id": "feed_src_1714720000000_ch_0",
  "chapterId": "src_1714720000000_ch_0",
  "type": "feed",
  "data": { "posts": [ ... ] },
  "generatedAt": "2026-05-03T12:00:00.000Z"
}
```

Other types and their `id` patterns are listed in
[`03-data-model.md`](03-data-model.md).

---

## Project row (Phase H)

```jsonc
{
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
  "createdAt": "2026-05-03T12:00:00.000Z",
  "updatedAt": "2026-05-03T12:00:00.000Z",
  "archived": false
}
```

---

## Project section row (Phase H)

```jsonc
{
  "id": "1",
  "projectId": "proj_1714720000000",
  "parentId": null,
  "number": "1",
  "title": "Introduction",
  "description": "Brief overview, hypothesis statement, thesis structure",
  "order": 1,
  "targetWords": 500,
  "status": "not_started",
  "content": "",
  "aiDraft": "",
  "wordCount": 0,
  "lastEdited": null,
  "relatedSourceIds": [],
  "relatedChapterIds": []
}
```

---

## Citation row (Phase Q)

```jsonc
{
  "id": "cit_1714720000000_a1b2c3",
  "projectId": "proj_1714720000000",
  "sectionId": "2.1",
  "sourceId": "src_1714720000000",
  "chapterId": "src_1714720000000_ch_3",     // optional
  "citationKey": "tims2012",
  "snippet": "Job crafting refers to physical and cognitive changes...",
  "page": "175",
  "note": "Use this for the operational definition",
  "createdAt": "2026-05-03T12:00:00.000Z",
  "updatedAt": "2026-05-03T12:00:00.000Z"
}
```

---

## Discovery result row (Phase L)

```jsonc
{
  "id": "sr_1714720000000_3_a1b2c3",
  "projectId": "proj_1714720000000",
  "title": "Job crafting and sales performance",
  "authors": "Tims, M., Bakker, A. B.",
  "abstract": "...",
  "journal": "Journal of Vocational Behavior",
  "year": 2018,
  "url": "https://...",
  "pdfUrl": "https://...",
  "relevanceScore": 92,
  "relevantConcepts": ["job crafting", "sales", "engagement"],
  "whyRelevant": "Direct empirical link between job crafting and sales outcomes.",
  "hypothesisMatches": ["H2", "H3"],
  "isFavorite": true,
  "rating": 5,
  "dismissed": false,
  "addedToLibrary": false,
  "batchId": "batch_1714720000000_a1b2c3",
  "dateFound": "2026-05-03T12:00:00.000Z"
}
```

---

## Research feedback row (Phase L)

```jsonc
{
  "id": "fb_1714720000000",
  "projectId": "proj_1714720000000",
  "action": "favorite",
  "sourceTitle": "Job crafting and sales performance",
  "sourceAuthors": "Tims, M., Bakker, A. B.",
  "sourceUrl": "https://...",
  "concepts": ["job crafting", "sales", "engagement"],
  "rating": null,
  "timestamp": "2026-05-03T12:00:00.000Z"
}
```

---

## Writing exercise row (Phase P)

```jsonc
{
  "id": "ex_1714720000000",
  "projectId": "proj_1714720000000",
  "sectionId": "2.1",
  "type": "expand_outline",
  "prompt": "- Definition of self-determination theory\n- Three innate needs",
  "hints": ["Start with Deci & Ryan", "Use academic tone"],
  "sampleAnswer": "Self-determination theory (Deci & Ryan, 2000)...",
  "userResponse": "Self-determination theory describes...",
  "aiFeedback": "Good start. Strengthen the link between needs and motivation.",
  "completed": true,
  "startedAt": "2026-05-03T11:00:00.000Z",
  "completedAt": "2026-05-03T11:18:00.000Z",
  "hintsUsed": 1
}
```

---

## Settings object

A flat `key: value` object. Only whitelisted keys (see
[`17-drive-sync.md`](17-drive-sync.md)) are recommended. Any unrecognized
key is still imported (it will end up in the IDB `settings` store).

Special keys to consider when crafting an import:
- `apiKey`, `perplexityApiKey`, etc. — overwrite the user's keys
- `activeProjectId` — sets the active project on import
- `selectedModel` — switches the Gemini model
- Custom prompts (`prompt_*`) — override defaults

Best practice: omit API keys from project-only imports unless intentional.

---

## How the local auto-import banner works

`init()` calls `checkForLocalImport()`:

```js
const response = await fetch('./chapterwise-import.json', { cache: 'no-store' });
if (!response.ok) return;
const syncData = await response.json();
if (!hasContent(syncData)) return;            // checks for any of the 12 stores
showImportBanner(syncData);
```

If a banner is shown:
- Counts: "X source(s), Y chapter(s), Z project(s), W citation(s) ready
  to import"
- Two actions: **Import** and **Dismiss**
- On Import: `acceptLocalImport()` → `importFromPackage(syncData)` →
  `importSyncDataIncremental(syncData)`.

---

## Service worker bypass

`sw.js` lists `chapterwise-import.json` in the pass-through allowlist so
the file is always re-fetched (never served from cache).

The `.gitignore` includes `chapterwise-import.json` so it's never
committed.

---

## File picker import (`handleImportFile`)

- Max 200 MB.
- Reads the file as text.
- `JSON.parse` — fails fast on bad JSON.
- Calls `importFromPackage(syncData)`.
- Detects `version: 1` envelopes and runs the v1→v2 coercion.

---

## Paste import (`executePasteImport`)

- Reads from the textarea.
- `JSON.parse` — fails fast.
- Calls `importFromPackage(syncData)`.

Useful when the cowork agent outputs JSON to stdout and the user copy-pastes.

---

## Import flow (`importFromPackage`)

```
1. Validate top-level shape (at least one known store array present).
2. Run v1→v2 coercion if version === 1 or `books` present.
3. Show toast "Importing N source(s) / M project(s)..."
4. importSyncDataIncremental(syncData):
   ├ for each source: inflate pdf_data if flagged, dbPut('sources', s)
   ├ for each chapter: dbPut('chapters', ch)
   ├ for each progress: dbPut('progress', p)
   ├ for each generated: dbPut('generated', g)
   ├ for each project: dbPut('projects', p)
   ├ for each project_section: dbPut('project_sections', s)
   ├ for each discovery_result: dbPut('discovery_results', r)
   ├ for each research_feedback: dbPut('research_feedback', f)
   ├ for each writing_exercise: dbPut('writing_exercises', e)
   ├ for each citation: dbPut('citations', c)
   └ for each settings entry: setSetting(k, v)
5. For each imported source without coverImage:
   render PDF page 1 → store as JPEG data URL
6. loadLibrary() to refresh the UI.
```

The flow is **idempotent**: re-importing the same package is safe (every
`dbPut` is an upsert by `id`).

---

## Generating an import package programmatically

The PDF pipeline skill in `CLAUDE.md` (see
[`23-pdf-pipeline-skill.md`](23-pdf-pipeline-skill.md)) is the canonical
way for Claude to produce these. Minimum needed for a library import:

```python
import json, time, base64

ts = int(time.time() * 1000)
src_id = f"src_{ts}"

with open("article.pdf", "rb") as f:
    pdf_b64 = base64.b64encode(f.read()).decode()

package = {
    "version": 2,
    "syncedAt": "2026-05-03T12:00:00.000Z",
    "type": "library",
    "sources": [{
        "id": src_id,
        "kind": "article",
        "title": "Article Title",
        "authors": ["Author Name"],
        "year": 2024,
        "tags": ["research"],
        "totalChapters": 1,
        "addedAt": "2026-05-03T12:00:00.000Z",
        "updatedAt": "2026-05-03T12:00:00.000Z",
        "pdfData": pdf_b64,
        "_pdfDataIsBase64": True,
    }],
    "chapters": [{
        "id": f"{src_id}_ch_0",
        "sourceId": src_id,
        "title": "Article Title",
        "number": 1,
        "index": 0,
        "content": "<cleaned text>",
        "text": "<cleaned text>",
    }],
    "progress": [],
    "generated": [],
    "settings": {}
}

with open("chapterwise-import.json", "w") as f:
    json.dump(package, f, ensure_ascii=False, indent=2)
```

For a project import, swap in the project + sections shortcut:

```python
package = {
    "version": 2,
    "type": "project",
    "project": {
        "id": f"proj_{ts}",
        "title": "My MA Thesis",
        "kind": "thesis",
        "language": "sl",
        "totalWordTarget": 9000,
        "hypotheses": ["H1: ...", "H2: ..."],
        "keywords": ["job crafting", "..."],
        "writingStyle": "academic",
        "createdAt": "2026-05-03T12:00:00.000Z",
        "updatedAt": "2026-05-03T12:00:00.000Z",
    },
    "sections": [
        {"id": "1",   "parentId": None, "number": "1",   "title": "Uvod",      "targetWords": 500, "order": 1},
        {"id": "2",   "parentId": None, "number": "2",   "title": "Pregled",   "targetWords": 0,   "order": 2},
        {"id": "2.1", "parentId": "2",  "number": "2.1", "title": "Definicija","targetWords": 600, "order": 1},
    ]
}
```

---

## Validation

The import is permissive — it doesn't reject unknown fields. But it does
require:

- At least one known top-level array (`sources`, `chapters`, `projects`,
  ...) **OR** a `project` shortcut object
- For PDF support, either `pdfData` (with `_pdfDataIsBase64: true`) or
  the `_pdfDataExcluded` flag

The cover-generation step inside `importFromPackage` is the only place
that derives data; everything else is pure storage.

---

## Continue reading

- Project entity and JSON shortcut: [`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md)
- Source vs Book migration: [`32-source-vs-book.md`](32-source-vs-book.md)
- Drive sync uses the same envelope: [`17-drive-sync.md`](17-drive-sync.md)
- PDF pipeline skill: [`23-pdf-pipeline-skill.md`](23-pdf-pipeline-skill.md)
