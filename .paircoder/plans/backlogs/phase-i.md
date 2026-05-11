# Sprint I: Source Generalization — Book → Source migration

> One task per T-item in `docs/implementation-plan/phase-i-source-generalization.md`.
> Generalize `Book` → `Source` with `kind: 'book' | 'article' | 'url' | 'note'`. Migrate IDB schema, update all generators, preserve full backward compatibility.
> Migration data loss is the HIGHEST risk in this sprint. Backup-first strategy mandatory.

### Phase 1: Schema + backup-first migration

### TI.1 -- Source interface + Dexie v3→v4 | Cx: 8 | P0

**Description:** Define `Source` interface (replacing `Book`) with `kind` field + per-kind metadata (DOI, journal, ISBN, publisher, URL, fetchedAt, noteContent). `SourceKind` type alias. Dexie schema with v3→v4 migration.

**AC:**
- [ ] zod schema covers all four kinds
- [ ] Per-kind metadata typed and required where applicable
- [ ] Migration includes a dry-run mode for testing
- [ ] Vitest fixtures: book, article, url, note all validated

**Depends on:** TG.4, TH.1

### TI.2 -- Migration script (rename store + fields) | Cx: 21 | P0

**Description:** Rename `books` store → `sources`. Coerce `author: string` → `authors: string[]`. Rename ID prefix `book_` → `src_`. Update `chapters.bookId` → `chapters.sourceId`. Update `generated` keys (`*_book_*` → `*_src_*`). Update `progress.bookId` → `progress.sourceId`.

**AC:**
- [ ] 50-source fixture migrates losslessly
- [ ] All ID prefixes renamed; no orphan rows
- [ ] Chapters / progress / generated all link via new sourceId
- [ ] Migration is idempotent (re-run is no-op)
- [ ] Vitest covers migration with 5+ fixtures

**Depends on:** TI.1

### TI.3 -- Pre-migration backup | Cx: 5 | P0

**Description:** Write all data to `generated` store with `type: 'migration_backup'` BEFORE running v4 migration. Backup file: `chapterwise-backup-pre-source-migration-<date>.json` also exported to user's Downloads.

**AC:**
- [ ] Backup written before any mutation
- [ ] Backup visible in Diagnostics page (sprint G)
- [ ] Backup downloadable as JSON
- [ ] Restore documented in README

**Depends on:** TI.2

### Phase 2: UI + import/export + dual-write sync

### TI.4 -- loadLibrary reads from sources + kind filter | Cx: 5 | P1

**Description:** Update `loadLibrary()` to read from `sources`. Add `kind` filter param.

**AC:**
- [ ] Library loads `sources` instead of `books`
- [ ] `kind` filter works with single + multi-kind selection
- [ ] Live query reactivity preserved
- [ ] Backward-compat alias `loadBooks()` deprecated with warning

**Depends on:** TI.2

### TI.5 -- Import/export pipeline (v1 books → v2 sources) | Cx: 8 | P1

**Description:** Handle both `books` and `sources` arrays. Auto-coerce v1 → v2.

**AC:**
- [ ] Old v1 JSON envelope imports cleanly as sources
- [ ] Export writes v2 envelope (`sources` field)
- [ ] Vitest covers both shapes
- [ ] Round-trip preserves all data

**Depends on:** TI.2

### TI.6 -- Drive sync v2 with dual-write | Cx: 8 | P0

**Description:** Update Drive sync envelope upload/download/merge for v2 with backward-compat **dual-write** (`books` and `sources` both written for two release cycles).

**AC:**
- [ ] Dual-write envelope readable by v1 and v2 clients
- [ ] v2 client reading v1 envelope auto-coerces
- [ ] Two-device test: v2 → v1 → v2 round-trip works
- [ ] Removal date for dual-write documented (target: sprint K complete)

**Depends on:** TF.7, TI.5

### TI.7 -- KindFilter + SourceCard + per-kind cover | Cx: 5 | P1

**Description:** `KindFilter` component on Library; `SourceCard` with kind badge; per-kind cover renderer (books get current; articles/URLs/notes get distinct styling).

**AC:**
- [ ] All 4 kinds visually distinct
- [ ] KindFilter sticky on scroll
- [ ] Per-kind cover renders without flicker
- [ ] Accessibility: kind badge has aria-label

**Depends on:** TI.4

### Phase 3: Reader + generators + tests

### TI.8 -- Reader: detect kind + branch UI | Cx: 5 | P1

**Description:** Books → existing 11-tab UI. Articles/URLs/notes → flat reader with all 11 modes still available.

**AC:**
- [ ] Book opens with tab UI unchanged
- [ ] Article opens with flat reader; mode switching available via dropdown
- [ ] URL/note: same flat reader; no chapter list
- [ ] Manual test on 3 kinds

**Depends on:** TI.7

### TI.9 -- Generators source-aware | Cx: 5 | P1

**Description:** `generateFeed`, `generateSummary`, etc. read from `chapters` (most unchanged). Rename API surface from "book" to "source" where exposed.

**AC:**
- [ ] All generators function identically post-rename
- [ ] No internal "book"-prefixed call sites remain (except renamed aliases)
- [ ] Generator unit tests updated

**Depends on:** TI.4

### TI.10 -- Top-level function renames + back-compat aliases | Cx: 3 | P2

**Description:** `generateBookFeed` → `generateSourceFeed` etc. Backward-compat function aliases for one release cycle.

**AC:**
- [ ] Renames applied; aliases marked `@deprecated`
- [ ] Removal date documented
- [ ] No external callers break

**Depends on:** TI.9

### TI.11 -- Tests (coercion + e2e) | Cx: 8 | P0

**Description:** Vitest tests on coercion logic; Playwright e2e for v1 → v2 upgrade with fixture v1 library; e2e for kind filtering; e2e for importing an article via Discovery (sprint L) creating `kind: 'article'` source.

**AC:**
- [ ] Coercion ≥ 90% branch coverage
- [ ] e2e: v1 fixture (50 sources) upgrades cleanly
- [ ] e2e: kind filter UI exercised
- [ ] Article-import e2e stubbed pending sprint L

**Depends on:** TI.6, TI.7

---

## Sprint enforcement gates (must pass before Sprint J begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Migrate** — 50-source fixture round-trip; pre-migration backup verified
- [ ] **G-Tests** — coverage ≥ 86%; coercion ≥ 90%
- [ ] **G-Manual** — Real-device migration test (iOS Safari) with 20+ book library
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint J:**

- [ ] How to communicate the kind change to user? Default: release notes + one-time toast
- [ ] Confirm migration runs in Web Worker on app boot with "Migrating your library…" screen
