# Phase I — Source Generalization

## Goal

Generalize the pre-merger `Book` entity into a unified `Source` (with
`kind: 'book' | 'article' | 'url' | 'note'`), migrate the IDB schema,
update all reading-mode generators to be source-aware, and preserve full
backward compatibility for existing books.

## Why this phase

Pre-merger Headway treated every library entry as a `Book`. Articles,
URLs, and notes had to fake themselves as single-chapter books. This
leaks through the UX (everything labeled "books"), through citations
(which need DOI/journal vs publisher/ISBN), and through Discovery (which
imports articles, not books).

Phase I unifies the model, migrates existing data, and keeps the legacy
import format readable.

## Prerequisites

- Phase G (Architectural Rebuild) — Dexie typed migrations
- Phase H (Multi-Project Workspaces) — projects ready to consume sources

## Deliverables

1. `Source` interface replacing `Book`, with `kind` field and per-kind
   metadata (DOI, journal, ISBN, publisher, URL, fetchedAt, noteContent).
2. IDB store rename: `books` → `sources` (Dexie v3→v4 migration).
3. `chapters.bookId` field renamed to `chapters.sourceId` (migration
   updates all rows).
4. `progress.bookId` → `progress.sourceId` (migration).
5. All `generated` keys with `_book_` substring renamed to `_src_`
   (migration).
6. `Source` library UI with `kind` filter chips (All / Books / Articles
   / URLs / Notes).
7. Different default cover styling per kind.
8. Per-kind reader UX: books → existing 11-tab; articles/URLs/notes →
   flat reader, all 11 modes still available.
9. Auto-coercion of legacy `books` array on import (v1 envelope).
10. Pre-migration backup exported automatically as
    `chapterwise-backup-pre-source-migration-<date>.json`.

## Task breakdown

- **T1**: Define `Source` interface; add `SourceKind` type alias.
  Update Dexie schema with v3→v4 migration.
- **T2**: Migration script — rename store, coerce `author: string` →
  `authors: string[]`, rename ID prefix `book_` → `src_`, update
  chapter `bookId` → `sourceId`, update generated keys, update
  progress.
- **T3**: Pre-migration backup — write all data to `generated` store
  with `type: 'migration_backup'` before running v4.
- **T4**: Update `loadLibrary()` to read from `sources`. Add `kind`
  filter param.
- **T5**: Update import / export pipeline to handle both `books` and
  `sources` arrays. Auto-coerce v1 → v2.
- **T6**: Update Drive sync envelope upload/download/merge for v2 schema
  with backward-compat dual-write (`books` and `sources` both written
  for two release cycles).
- **T7**: UI: `KindFilter` component on Library; update `SourceCard`
  with kind badge; per-kind cover renderer.
- **T8**: Update reader: detect kind, switch between book-tab UI and
  flat-reader UI.
- **T9**: Update generators (`generateFeed`, `generateSummary`, etc.) —
  they read from `chapters` so most are unchanged; rename API surface
  from "book" to "source" where exposed.
- **T10**: Rename top-level functions: `generateBookFeed` →
  `generateSourceFeed`, etc. Backward-compat function aliases for one
  release.
- **T11**: Tests — Vitest tests on coercion logic; Playwright e2e for
  v1 → v2 upgrade with a fixture v1 library; e2e for kind filtering;
  e2e for importing an article via Discovery (Phase L) creating a
  `kind: 'article'` source.

## Acceptance criteria

- Existing user with N books in v1 IDB upgrades cleanly: same data,
  zero loss.
- Pre-migration backup exists in `generated` store (verifiable via
  Diagnostics page).
- A new article import (from any path) creates a source with
  `kind: 'article'`.
- Library UI shows kind chips; clicking "Articles" filters correctly.
- Reading modes work identically for books and articles (both use
  `chapters` rows).
- Drive sync round-trips a v2 library; downgrading to a previous build
  reads `books` from the dual-write envelope and works.
- Tests pass; e2e includes a real fixture library in v1 shape.

## Effort estimate

- T-shirt: **M**
- Person-weeks: **2–3**

## Risks & unknowns

- **Migration data loss** is the highest risk. Mitigation: backup before
  migration, write tests with a 50-source fixture.
- **Sync envelope dual-write** — if a v2 client uploads dual-write and
  a v1 client reads, the v1 client picks `books` and works. If a v1
  client writes (just `books`) and a v2 client reads, the v2 importer's
  auto-coerce kicks in. Two release cycles of dual-write should cover
  the rollout.
- **`generated` key migration** — the rename `*_book_*` → `*_src_*` must
  not break in-flight generations. Mitigation: migration runs at boot
  before any new generation is dispatched.

## Out of scope

- Phase L Discovery's article ingestion uses `kind: 'article'` but is
  delivered separately
- Source library cross-project view — Phase Q
- Per-kind quiz tuning (e.g. articles get harder questions) — Phase J
  follow-up

## Decision points (revisit before Phase L)

- ✅ Migration runs in a Web Worker on app boot, with a one-time
  "Migrating your library…" screen.
- ⚠ How to communicate the kind change to the user? Default plan:
  release notes + a one-time toast "Your library now supports articles,
  URLs, and notes!"
