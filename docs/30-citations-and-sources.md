# 30 — Citations & Source Library

A **Citation** binds a Source (a library entry — book, article, URL, note)
to a section of a project, marking that the section relies on that source
for a specific claim. Citations power: in-text citations in the writing
flow, automated bibliography generation, BibTeX/RIS export, and the
research-graph visualisation.

> Implemented in Phase Q (`implementation-plan/phase-q-citations-and-sources.md`).
> New to Headway — neither pre-merger Headway nor ThesisCraft had a real
> citation model. ThesisCraft had a `relatedArticleIds[]` field on
> sections but no UI to populate it.

---

## Data model

### `citations` IDB store (new in Phase Q)

```ts
interface Citation {
  id: string;                  // "cit_<ts>_<rand>"
  projectId: string;
  sectionId: string;           // section that uses the citation
  sourceId: string;            // a Source from the library (Phase I)
  chapterId?: string;          // optional, for multi-chapter sources (book chapters)
  citationKey: string;         // BibTeX-style key, e.g. "tims2012"
  snippet?: string;            // optional verbatim quote pulled from source
  page?: string;               // page number, page range ("12-15"), or %-based locator
  note?: string;               // user's annotation about why this citation matters
  createdAt: string;
  updatedAt: string;
}
```

Indexed by `id`, `projectId`, `sectionId`, `sourceId`.

---

## Source library

The Source library is a unified view of all entries across the four
`Source` kinds (book, article, url, note). See
[`32-source-vs-book.md`](32-source-vs-book.md) for the underlying model.

A new top-level "Sources" tab (or expansion of "Library") presents:

- Filter by `kind`, by date added, by project (sources cited in project X)
- Sort by recency, alphabetical, citation count
- Bulk select for: tag, archive, delete, "add to project N"
- Per-source actions: **Open**, **Export BibTeX**, **Cite in this section**,
  **View citations** (which sections use it)

---

## Citation key generation

When creating a Citation, Headway generates a BibTeX-style key:

```
{firstAuthorLastNameLowercased}{year}
```

Examples: `tims2012`, `bakker2018`, `denbrabander2024`.

Collisions: append a letter (`tims2012a`, `tims2012b`) within the same
project. Project-scoped uniqueness is sufficient for export.

If a Source has no authors (e.g. a URL) the key falls back to a
slug-of-title: `pomodoro-method-ny-times-2019`.

---

## In-text citation picker

In the Section Editor's Markdown editor (Phase O follow-up), the user
types `/cite` (slash command) to open the **Citation Picker**:

```
┌────────────────────────────────────────┐
│  Cite a source                         │
│  ┌──────────────────────────────────┐  │
│  │ [search box]                     │  │
│  └──────────────────────────────────┘  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ⭐ Tims et al. (2012) — Job Crafting  │
│      Used 4× in this project           │
│      [+ in-text]  [+ parenthetical]    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Bakker (2018) — Engagement Review     │
│      Used 1× in this project           │
│      [+ in-text]  [+ parenthetical]    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  + Add new source                      │
└────────────────────────────────────────┘
```

Search matches: `title`, `authors`, `citationKey`, `concepts`. Sorted by:
"already used in this project" (top), then by recency.

Two insertion modes:
- **In-text** (`Tims et al. (2012)`) — turns into Markdown:
  `[Tims et al. (2012)](#cite-tims2012)`
- **Parenthetical** (`(Tims et al., 2012)`) — turns into Markdown:
  `([Tims et al., 2012](#cite-tims2012))`

Both modes write a Citation to the IDB store and link by `sectionId`.

The hash-based link (`#cite-tims2012`) lets the bibliography auto-generate
clickable backlinks. The link rendering hides the URL on display and
shows only the in-text citation.

---

## Auto-bibliography

At the end of each section's content, Headway can auto-render a "Sources
cited in this section" block:

```
References

Tims, M., Bakker, A. B., & Derks, D. (2012). Development and validation
of the job crafting scale. Journal of Vocational Behavior, 80(1), 173-186.

Bakker, A. B. (2018). Job crafting among health care professionals…
```

Toggleable per project (`settings.bibliography_<projectId>` = `'inline' |
'end-only' | 'off'`).

End-of-project: aggregated bibliography pulling all citations (deduped by
`citationKey`).

Format: APA 7 default. Phase Q follow-up adds Vancouver, Chicago, MLA,
Harvard via [Citation Style Language (CSL)](https://citationstyles.org/) JSON.

---

## BibTeX export

Per project: `Settings → Project → Export BibTeX`.

Output:

```bibtex
@article{tims2012,
  author = {Tims, M. and Bakker, A. B. and Derks, D.},
  title = {Development and validation of the job crafting scale},
  journal = {Journal of Vocational Behavior},
  volume = {80},
  number = {1},
  pages = {173--186},
  year = {2012},
}
```

Pulls from Source metadata (authors, title, year, journal, volume, issue,
pages, doi, url). Missing fields are simply omitted (BibTeX permissive).

Phase Q follow-up: RIS export (Endnote/Mendeley friendly) and CSL-JSON
export (universal interchange).

---

## BibTeX / RIS import

Bibliography → "Import" → file picker or paste:

- Each `@article{...}` becomes a Source with `kind: 'article'`
- Existing Sources matched by `doi` or `(authors[0], year, title)` tuple
  are upserted (not duplicated)
- `note` and `keywords` from BibTeX flow into Source metadata
- Optionally: assign all imported sources to the active project (not
  individual sections — that requires manual citation step)

---

## Zotero / Mendeley integration

Both tools can export to BibTeX, so the BibTeX importer is the lightest
integration path.

Phase Q follow-up adds direct API integration:

- **Zotero**: OAuth 2.0 flow, library sync (read-only initially)
- **Mendeley**: deprecated but Mendeley Desktop still exports BibTeX

---

## DOI / OpenAlex / CrossRef enrichment

When a Source is created with only a title or DOI, Headway can enrich it
with full metadata:

```
/api/lookup/doi.js (Vercel proxy):
  GET → CrossRef → returns author list, journal, year, abstract, ...
```

```
/api/lookup/openalex.js (Vercel proxy):
  GET → OpenAlex → returns concepts, citations count, related works
```

Both proxies cache responses for 7 days in `generated` store with
`type: 'lookup_doi'` / `'lookup_openalex'` keyed by DOI.

This integrates with Phase L (Discovery) — every Discovery result with
a DOI is auto-enriched on add-to-library. Auto-fixes the TC issue where
Perplexity sometimes hallucinates non-existent citations: a DOI lookup
that returns 404 flags the source as `_unverified: true` and shows a red
banner in the source detail view.

---

## Research graph (Phase W)

Phase Q just stores citations. Phase W (Knowledge+) builds the graph:

- Nodes: sources, sections, hypotheses, concepts
- Edges: citations (source → section), hypothesis-mentions
  (hypothesis → section), concept-overlap (source ↔ source)
- Visualization: force-directed graph using a worker (Phase G modular
  arch enables this)
- Use cases: "find all sources that cite each other and support H1",
  "show me the citation cluster around 'autonomy'"

---

## Operations

| Operation | Where | Cost |
|---|---|---|
| Create citation via picker | `/cite` slash command | local |
| Edit citation (page, snippet, note) | Citation list panel in Section Editor | local |
| Delete citation | Citation list panel | local |
| List citations for source | Source detail view | local |
| List citations for section | Section detail view | local |
| Export BibTeX | Project settings | local |
| Import BibTeX | Project settings | local |
| Auto-render bibliography | Section content rendering | local |
| DOI lookup | Source creation, Discovery import | 1 paid call (CrossRef is free, OpenAlex is free) |

---

## Continue reading

- Source entity (the thing being cited): [`32-source-vs-book.md`](32-source-vs-book.md)
- Writing Hub uses citations in drafts: [`28-writing-hub.md`](28-writing-hub.md)
- Discovery results with DOIs auto-enrich on add-to-library: [`27-discovery-module.md`](27-discovery-module.md)
- Research graph visualization: see Phase W in `implementation-plan/phase-w-knowledge-plus.md`
