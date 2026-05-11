# Phase Q — Citations & Source Library

## Goal

Add a `Citation` entity that binds a Source (library entry) to a section
of a project, with an in-text citation picker, BibTeX export, BibTeX/RIS
import, DOI/OpenAlex enrichment, and auto-bibliography rendering.

## Why this phase

Citations are the missing link between the Source library and the WRITE
pillar. Pre-merger Headway had no citation model; ThesisCraft had a
`relatedArticleIds[]` field but no UI to populate it. Phase Q delivers
the full system so users can write academically with proper citations.

## Prerequisites

- Phase G (Architectural Rebuild)
- Phase I (Source Generalization) — Sources have kind, DOI, journal, etc.
- Phase O (Writing Hub) — sections to attach citations to

## Deliverables

1. New IDB store `citations` (Phase Q).
2. `Citation` entity with `citationKey` (BibTeX-style), `snippet`,
   `page`, `note`.
3. **In-text citation picker** — `/cite` slash command in the Markdown
   editor opens a modal listing project sources, sortable, searchable.
4. Two insertion modes (in-text, parenthetical) writing Markdown links
   like `[Tims et al. (2012)](#cite-tims2012)`.
5. **Auto-citationKey generation** with collision detection.
6. **Bibliography auto-render** at end of section / project.
7. **BibTeX export** (per project).
8. **BibTeX import** (BibTeX file → Sources, with dedup by DOI / title
   tuple).
9. **DOI / OpenAlex enrichment** via Vercel proxy `/api/lookup/doi.ts`
   and `/api/lookup/openalex.ts`.
10. **Discovery integration** — adds "Cite from result" button to
    Discovery cards (Phase L cooperates).
11. Source library cross-project view at `/sources` showing all Sources
    + which projects cite them.

## Task breakdown

- **T1**: Define `Citation` interface; Dexie store + migration.
- **T2**: Citation key generator: `firstAuthorLastName + year` lowercased,
  with collision suffix (`a`, `b`, ...).
- **T3**: `<CitationPicker>` modal — search box, list of sources sorted
  by "used in this project" then recency; insert buttons.
- **T4**: Markdown editor `/cite` slash command (Phase O follow-up
  Markdown editor lands first).
- **T5**: Citation insertion: writes Markdown link + creates Citation
  row.
- **T6**: Citation list panel in `SectionEditor` — list all citations
  on this section, edit page/snippet/note inline.
- **T7**: Auto-bibliography renderer:
  - `bibliography_<projectId>` setting: `'inline' | 'end-only' | 'off'`
  - APA 7 format (Phase Q ships with APA only; Vancouver/MLA/Chicago
    via CSL JSON in follow-up)
- **T8**: BibTeX export — generate `.bib` file from project's citations.
- **T9**: BibTeX import — parser (use `@retorquere/bibtex-parser` or
  similar), dedup by DOI then title tuple, create Sources.
- **T10**: Vercel proxy `/api/lookup/doi.ts` (CrossRef wrapper). Cache
  in `generated` store with `type: 'lookup_doi'` for 7 days.
- **T11**: Vercel proxy `/api/lookup/openalex.ts` (OpenAlex wrapper).
  Cache similarly.
- **T12**: Source enrichment flow — when user creates a Source by URL
  or DOI, auto-call lookup. When Discovery imports a result with DOI,
  auto-call lookup before saving.
- **T13**: Source library cross-project view `/sources` — list all
  Sources with filter / sort + per-source citation map.
- **T14**: Drive sync envelope: add `citations`.
- **T15**: Tests — Vitest on citation key generation, BibTeX
  import/export, dedup logic. Playwright e2e for "type /cite → pick a
  source → see in-text citation in section → see in bibliography".

## Acceptance criteria

- A user can type `/cite` in a section, pick a Source from the modal,
  and see the citation appear in the editor.
- The Citation row is created in IDB, viewable from the section's
  citation list panel.
- Bibliography auto-renders at the end of a section or project (toggle
  in Settings).
- BibTeX export produces a valid `.bib` file readable by Zotero,
  Mendeley, LaTeX.
- BibTeX import creates Sources without duplicating existing ones (dedup
  by DOI then title+year+firstAuthor).
- DOI lookup populates `journal`, `volume`, `pages`, etc. on the Source.
- Discovery results with DOI auto-enrich on add-to-library.
- Cross-project source view shows which projects cite each source.
- Drive sync round-trips citations.
- Tests pass; ≥ 90 % coverage on BibTeX parser and citation key
  generator.

## Effort estimate

- T-shirt: **M**
- Person-weeks: **3–4**

## Risks & unknowns

- **CSL JSON** — Phase Q ships APA only via a hand-rolled formatter.
  Adding Vancouver/MLA/Chicago would mean integrating a CSL processor
  (`citeproc-js`); deferred to Phase Q follow-up to keep scope bounded.
- **BibTeX dialects** — different exporters produce different shapes
  (especially around `author` field formatting). Use a tolerant parser
  with sensible defaults.
- **DOI verification of hallucinated articles** — Phase L surfaces
  potentially fake citations from Perplexity. Phase Q's lookup gives
  authoritative metadata. If lookup returns 404, mark
  `_unverified: true`.
- **Citation graph performance** — for projects with 200+ citations,
  rendering the citation map should be virtualized.

## Out of scope

- CSL JSON support for non-APA styles — Phase Q follow-up
- Direct Zotero / Mendeley API integration (OAuth flow) — Phase Q
  follow-up. BibTeX import is the lightest path.
- Citation graph visualization — Phase W
- AI auto-suggest citations from a draft — Phase X

## Decision points (revisit before Phase R)

- ⚠ Should bibliography render in Markdown source or only on render?
  Decision: render-only (don't pollute the user's Markdown). The
  bibliography is computed from `citations` rows.
- ⚠ Should we offer Zotero OAuth in Phase Q? Decision: no (extra
  complexity, BibTeX covers the use case). Reconsider in Phase Q
  follow-up.
- ✅ Citation key collision strategy — append letter (a, b, c, ...).
