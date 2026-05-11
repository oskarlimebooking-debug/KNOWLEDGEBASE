# 32 — Source vs Book (Migration Guide)

The merged Headway generalizes the pre-merger `Book` entity into a
**`Source`** — a unified abstraction over books, articles, URLs, and
notes. This document explains the migration, the new model, the
backward-compat strategy, and what changes for downstream features.

> Implemented in Phase I
> (`implementation-plan/phase-i-source-generalization.md`),
> after Phase G (architectural rebuild) has migrated to TypeScript +
> modular code.

---

## Why generalize

Pre-merger Headway treated everything as a `Book`:

- A 600-page Sapiens PDF with 20 chapters: `book` ✓
- A 12-page academic article in PDF: `book` ✓ (with `totalChapters: 1`)
- A 30-second blog post pasted as text: `book` ✓ (with one chapter)

This worked, but it leaked through the UX:
- The library labelled everything "books" even when the user added 50 articles
- Search and filter offered no way to see "only articles" or "only my notes"
- Discovery's "Add to library" had to fake a single-chapter book
- Citation/bibliography (Phase Q) needs to know whether something is a
  journal article (with DOI/journal) vs a book (with publisher/ISBN) vs a
  URL (with fetched-on date)

A `kind` field disambiguates and unlocks correct behaviour per type.

---

## The Source model

### `sources` IDB store (renamed from `books` in Phase I)

```ts
interface Source {
  id: string;                  // "src_<ts>" (was "book_<ts>")
  kind: 'book' | 'article' | 'url' | 'note';
  title: string;
  authors: string[];           // array (was string in Book)
  year?: number;
  language?: string;           // BCP-47, e.g. "en", "sl"
  description?: string;
  tags: string[];

  // PDF binary (books, articles, URL-as-PDF, …)
  pdfData?: ArrayBuffer;
  _pdfDataIsBase64?: boolean;
  _pdfDataExcluded?: boolean;
  coverImage?: string;         // data: URL JPEG

  // Per-kind metadata (loose union)
  doi?: string;                // articles
  journal?: string;            // articles
  volume?: string;             // articles
  issue?: string;              // articles
  pages?: string;              // articles
  publisher?: string;          // books
  isbn?: string;               // books
  url?: string;                // articles, urls
  fetchedAt?: string;          // urls (ISO)
  noteContent?: string;        // notes (the note's body lives here, not in chapters)
  _unverified?: boolean;       // articles imported from Discovery without DOI verification

  totalChapters: number;
  addedAt: string;
  updatedAt: string;
}
```

### `chapters` store (unchanged)

Still keyed by `<sourceId>_ch_<index>`. Article-kind sources usually have
one chapter; book-kind have many; note-kind have one (mirroring TC's
flat-content shape); URL-kind has one (the scraped/extracted text).

---

## Per-kind defaults

| Kind | Typical chapters | Cover | Cite as | Reader UX |
|---|---|---|---|---|
| `book` | many | PDF p1 | book BibTeX | book chapters list |
| `article` | 1 | PDF p1 | journal BibTeX | flat reader |
| `url` | 1 | site favicon or screenshot | webpage BibTeX | flat reader |
| `note` | 1 | colored swatch (from tag) | misc BibTeX | flat reader |

---

## Migration: `books` → `sources`

Phase I includes a one-shot IDB migration:

```ts
// Phase I: migrateBooksToSources
async function migrateBooksToSources(db: IDBDatabase) {
  const oldBooks = await dbGetAll(db, 'books');

  for (const oldBook of oldBooks) {
    const newSource: Source = {
      id: oldBook.id.replace(/^book_/, 'src_'),  // "book_..." → "src_..."
      kind: 'book',                              // default; user can change later
      title: oldBook.title,
      authors: typeof oldBook.author === 'string'
        ? [oldBook.author].filter(Boolean)
        : (oldBook.author ?? []),
      year: oldBook.year,
      tags: oldBook.tags ?? [],
      description: oldBook.description,
      pdfData: oldBook.pdfData,
      _pdfDataIsBase64: oldBook._pdfDataIsBase64,
      coverImage: oldBook.coverImage,
      totalChapters: oldBook.totalChapters,
      addedAt: oldBook.addedAt,
      updatedAt: new Date().toISOString(),
    };

    await dbPut(db, 'sources', newSource);
    await migrateChapterIdsForSource(db, oldBook.id, newSource.id);
    await migrateGeneratedKeysForSource(db, oldBook.id, newSource.id);
    await migrateProgressForSource(db, oldBook.id, newSource.id);
  }

  // After all sources written, drop the old store
  await deleteObjectStore(db, 'books');
}
```

The migration:

1. Renames each `book_<ts>` → `src_<ts>` (with collision-safe suffix
   if needed).
2. Coerces `author: string` → `authors: string[]`.
3. Updates every `chapters` row's `bookId` → `sourceId` (and renames the
   field).
4. Updates every `generated` row's keys: `*_book_<ts>_*` → `*_src_<ts>_*`.
5. Updates every `progress` row's `bookId` → `sourceId`.
6. Drops the `books` object store.

Migration runs once on first launch of the Phase-I version and is gated
by an IDB version bump (`ChapterWiseDB` v1 → v2).

A pre-migration backup is exported automatically to `chapterwise-backup-pre-source-migration-<date>.json` and stored in
`generated` with `type: 'migration_backup'` so the user can restore.

---

## Backward-compat in the import format

The unified import envelope (see [`22-import-file-format.md`](22-import-file-format.md))
accepts both old and new shapes:

```jsonc
{
  "version": 2,            // bumped from 1 in Phase I
  "books":   [ /* legacy book rows; auto-coerced to sources */ ],
  "sources": [ /* new source rows */ ],
  "chapters":[ /* uses bookId or sourceId — both accepted */ ],
  ...
}
```

If both `books` and `sources` are present, `sources` wins. The importer
auto-coerces any `books` to `sources` with `kind: 'book'`.

Older Headway versions (pre-Phase I) reading a v2 file simply ignore
unknown fields like `kind`; they treat all entries as books and lose
some metadata. Acceptable for one-way upgrade scenarios; we recommend
syncing on the upgraded device first.

---

## Sync envelope (`chapterwise-sync.json`)

The Drive sync schema is:

```jsonc
{
  "version": 2,
  "syncedAt": "...",
  "sources":         [ ... ],   // generalized library
  "chapters":        [ ... ],   // unchanged shape, sourceId field
  "progress":        [ ... ],
  "generated":       [ ... ],
  "settings":        { ... },
  "projects":        [ ... ],   // Phase H
  "project_sections":[ ... ],   // Phase H
  "discovery_results":[ ... ],  // Phase L
  "research_feedback":[ ... ],  // Phase L
  "discovery_cache": [ ... ],   // Phase L (optional, often skipped)
  "writing_exercises":[ ... ],  // Phase P
  "citations":       [ ... ]    // Phase Q
}
```

Older clients (v1) reading a v2 sync file:
- See `sources` and don't know what to do; they fall back to looking for
  `books` (which is missing).
- We add a v1→v2 compatibility shim during the Phase I rollout: the sync
  upload writes both `books` (legacy projection of `sources`) and
  `sources` for two release cycles, then drops `books`.

---

## UI changes

### Library

- New **Kind filter** chips: All | Books | Articles | URLs | Notes
- Per-row badge showing the kind
- Different default cover style per kind:
  - Books: PDF page 1
  - Articles: PDF page 1 with a paper-style overlay
  - URLs: site favicon zoomed onto a colored card
  - Notes: a tag-color swatch with the title

### Source detail / reader

- Books → unchanged 11-tab reading mode UI
- Articles → flat reader (no chapter navigation), but all 11 modes still
  available (Read, Listen, Quiz, Feed, etc.) since they generate from
  the single chapter's content
- URLs → flat reader + a "Open original" button
- Notes → Markdown editor (read/write), Listen and Feed only (no Quiz
  by default)

### Citations

The Citation Picker (Phase Q) shows source kind in the picker for clarity:
`📰 Tims et al. (2012) — Job Crafting Scale`

---

## Reading-mode adapters

A few generators have to know about kind to behave well:

- **Quiz / Flashcards / Mind Map / Feed** — work for all kinds; for
  notes, generation might return fewer items because the source is short.
- **Cross-Source Feed** (Phase S, was Cross-Book Feed) — works across all
  kinds: an article cross-referenced into a book, a note vs a book, etc.
- **Video** — Phase R — book chapters work great; for short URL/note
  sources, the video is also short (Vadoo respects character limits).
- **Audiobook playback** (Phase V) — `kind: 'book'` only; articles and
  notes use TTS (no concept of "the audiobook of an article").

---

## What stays the same

- IDB schema for `chapters`, `progress`, `generated`, `settings`
- Drive sync algorithm (just more stores in the envelope)
- Service worker behaviour
- All reading-mode generators (they read from `chapters`, not `sources`)
- Cover thumbnail generation pipeline (PDF page 1 → JPEG)
- `chapterwise-import.json` auto-detection banner

---

## Code changes (high-level)

| Old | New |
|---|---|
| `book` everywhere | `source` |
| `bookId` column | `sourceId` column (chapters, progress, etc.) |
| `dbGet('books', ...)` | `dbGet('sources', ...)` |
| `loadLibrary()` returns `Book[]` | `loadLibrary(filter?: { kind?: SourceKind })` returns `Source[]` |
| Book-specific generators (e.g. `generateBookFeed`) | Source-specific (`generateSourceFeed` with `kind` switch) |
| `book.author: string` | `source.authors: string[]` |

A codemod (Phase G's TypeScript migration) is the right place to do most
of this.

---

## Continue reading

- Library import accepts both shapes: [`22-import-file-format.md`](22-import-file-format.md)
- Citations rely on Source kind: [`30-citations-and-sources.md`](30-citations-and-sources.md)
- Discovery creates `kind: 'article'` Sources: [`27-discovery-module.md`](27-discovery-module.md)
- Phase G architectural rebuild prerequisite: see `implementation-plan/phase-g-architectural-rebuild.md`
- Phase I migration spec: see `implementation-plan/phase-i-source-generalization.md`
