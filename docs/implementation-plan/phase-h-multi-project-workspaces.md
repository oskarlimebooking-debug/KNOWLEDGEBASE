# Phase H — Multi-Project Workspaces

## Goal

Add a `Project` entity (and `ProjectSection` outline) so the user can
create, switch, and import multiple research/writing projects, each with
its own outline, hypotheses, keywords, and writing style.

## Why this phase

Pre-merger Headway had no concept of "what am I working towards?" —
just a library. ThesisCraft hard-coded one thesis. The merger generalizes
this into a multi-project model that backs the RESEARCH and WRITE pillars
without breaking the existing READ pillar (no-project mode preserves
backward compatibility).

The user-confirmed requirement is to **import a JSON file with the full
project structure** (outline, hypotheses, keywords, titles, subtitles)
in one go.

## Prerequisites

- Phase G (Architectural Rebuild) — Dexie schema, modular UI shell
- Phase F (Cloud Sync) — pattern for adding stores to the Drive envelope

## Deliverables

1. New IDB stores `projects` and `project_sections` (Dexie typed schema).
2. Project switcher UI in the top nav (next to Drive sync).
3. New Library / Discovery / Writing top-level navigation as siblings of
   the existing book grid.
4. Create-project modal with three presets (Empty thesis, Empty article,
   Empty book outline) and a Blank option.
5. **JSON project import** — accept a `chapterwise-import.json` envelope
   with `type: "project"` shortcut OR `projects` + `project_sections`
   arrays.
6. **Project hub view** — minimal MVP: title, kind, dates, totals,
   buttons (Edit metadata, Export, Archive, Delete).
7. No-project mode — when `activeProjectId` is `null`, Discovery uses
   global keywords, Writing tab is hidden, everything else works as
   pre-merger.
8. Drive sync envelope extended to include `projects` and
   `project_sections`.

## Task breakdown

- **T1**: Define `Project` and `ProjectSection` interfaces in
  `src/data/stores/projects.ts` and `projectSections.ts`. Add Dexie
  migration v2→v3.
- **T2**: Top-bar `ProjectSwitcher` component with dropdown listing all
  projects + actions ("New project", "Import from JSON", "Manage…").
- **T3**: Side-nav additions for Discovery and Writing (hidden in
  no-project mode).
- **T4**: `useProjectStore` (Zustand) with `activeProjectId`, derived
  `activeProject`. Persist `activeProjectId` to settings via Dexie
  LiveQuery sync.
- **T5**: Project create modal with 4 preset templates. Each preset
  generates seed `ProjectSection` rows.
- **T6**: JSON project import flow — extend `importFromPackage` to
  accept the new `projects` / `project_sections` / `project` shortcut.
  Idempotent upsert by ID.
- **T7**: Auto-import banner — extend `checkForLocalImport` detection
  to count projects + sections.
- **T8**: Project Hub view — minimal: shows project metadata, list of
  recently-edited sections, simple actions.
- **T9**: Edit-project metadata modal (title, kind, language,
  hypotheses, keywords, writingStyle, totalWordTarget).
- **T10**: Archive / unarchive / delete project (with confirmation +
  cascade delete of sections + citations).
- **T11**: Drive sync envelope extension — add `projects` and
  `project_sections` to upload, download, merge.
- **T12**: Migration: existing users see the new nav with no projects
  yet; their library and reading flows are unchanged.
- **T13**: Tests — Vitest unit tests on `Project` validators, project
  JSON import, section path-IDs validity. Playwright e2e for
  "create project → switch active → write in section → switch
  back → see saved content".

## Acceptance criteria

- A user with **zero projects** still sees a working library and reading
  modes (no-project mode).
- A user can create a project from a preset and the seeded sections
  appear in the outline.
- A user can paste a JSON file with `type: "project"` and the project +
  sections + (optional) hypotheses appear.
- Switching the active project updates Discovery's keywords and
  Writing's outline immediately.
- Drive sync round-trips projects + sections without data loss.
- Re-importing the same JSON file does not duplicate (upsert by ID).
- Tests pass; coverage on JSON validators ≥ 90 %.

## Effort estimate

- T-shirt: **M**
- Person-weeks: **3–4**

## Risks & unknowns

- **No-project mode UX** — getting "Discovery is hidden when no project"
  vs "Discovery uses global keywords" right requires play-testing.
  Decision: always show Discovery with global keyword fallback; hide
  Writing only.
- **Project ID collisions** during JSON import (two users sharing a
  template). Mitigation: if user imports a project whose ID already
  exists, ask "Overwrite or create new?".
- **Cascade delete safety** — deleting a project should NOT delete
  library Sources. Citations are deleted, exercises are deleted,
  sections are deleted, sources stay.

## Out of scope

- Project sharing / collaboration — Phase Y
- Citations — Phase Q (just the data model is here, no Citation Picker)
- Discovery / Writing — separate phases
- Project templates marketplace — Phase Y

## Decision points (revisit before Phase L)

- ✅ Is the JSON import format final? (See [`docs/22-import-file-format.md`](../22-import-file-format.md).)
- ⚠ Is project archiving sufficient or do we need "soft delete" with
  recovery period?
- ⚠ Should project switcher show recent vs alphabetical first?
