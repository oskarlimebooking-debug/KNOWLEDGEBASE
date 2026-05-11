# Sprint Q: Citations & Source Library — entity, picker, BibTeX, DOI/OpenAlex

> One task per T-item in `docs/implementation-plan/phase-q-citations-and-sources.md` (T1–T15 in source doc).
> `Citation` entity binding a Source to a project section. In-text citation picker, BibTeX export/import, DOI/OpenAlex enrichment, auto-bibliography.

### Phase 1: Data + key generation

### TQ.1 -- Citation interface + Dexie store | Cx: 5 | P0

**Description:** zod schema for `Citation`. Dexie store + migration.

**AC:**
- [ ] Schema covers fields: id, projectId, sourceId, sectionId, key, locator, addedAt
- [ ] Migration applies cleanly
- [ ] Vitest covers schema

**Depends on:** TH.1, TI.1

### TQ.2 -- Citation key generator | Cx: 5 | P0

**Description:** `firstAuthorLastName + year` lowercased. Disambiguate collisions with `a/b/c` suffix.

**AC:**
- [ ] Stable for same source
- [ ] Disambiguation deterministic
- [ ] Non-ASCII author names handled (latinize then key)
- [ ] Vitest covers 20+ cases

**Depends on:** TQ.1

### Phase 2: Picker + insertion + bibliography

### TQ.3 -- CitationPicker modal | Cx: 8 | P1

**Description:** Search box. List of sources sorted by relevance/recency. Multi-select.

**AC:**
- [ ] Search filters by title, author, year
- [ ] Multi-select returns array
- [ ] Keyboard navigable (↑↓/Enter)
- [ ] Empty state when no library

**Depends on:** TQ.1

### TQ.4 -- /cite slash command in SectionEditor | Cx: 5 | P1

**Description:** Markdown editor `/cite` triggers CitationPicker. (Follows up sprint O.)

**AC:**
- [ ] Slash command opens picker
- [ ] Insertion preserves cursor position
- [ ] Undo restores pre-insert state

**Depends on:** TO.5, TQ.3

### TQ.5 -- Citation insertion | Cx: 5 | P0

**Description:** Writes Markdown link `[citation-key](#cite-key)` and creates `Citation` row.

**AC:**
- [ ] Insertion atomic (link + row in single transaction)
- [ ] Duplicate citations in same section dedup'd
- [ ] Locator (page number etc.) optional

**Depends on:** TQ.2, TQ.4

### TQ.6 -- Citation list panel in SectionEditor | Cx: 5 | P1

**Description:** Lists all citations in current section.

**AC:**
- [ ] LiveQuery for reactivity
- [ ] Click navigates to source
- [ ] Delete removes citation + Markdown link

**Depends on:** TQ.5

### TQ.7 -- Auto-bibliography renderer | Cx: 8 | P1

**Description:** Generate bibliography from project's citations. Style: APA / MLA / Chicago.

**AC:**
- [ ] All 3 styles render
- [ ] Style toggle in section editor
- [ ] Vitest snapshot per style

**Depends on:** TQ.6

### Phase 3: BibTeX + DOI/OpenAlex enrichment

### TQ.8 -- BibTeX export | Cx: 5 | P1

**Description:** Generate `.bib` from project's citations.

**AC:**
- [ ] Output parses in Zotero / JabRef
- [ ] Special chars escaped
- [ ] Vitest covers 10+ source kinds

**Depends on:** TQ.6

### TQ.9 -- BibTeX import (@retorquere/bibtex-parser) | Cx: 8 | P1

**Description:** Parser creates Sources + Citations from .bib file.

**AC:**
- [ ] 100-entry .bib imports without error
- [ ] Duplicate detection by DOI / key
- [ ] Per-entry errors surface

**Depends on:** TQ.1

### TQ.10 -- /api/lookup/doi (CrossRef) | Cx: 5 | P1

**Description:** Vercel proxy wrapping CrossRef. Cache results.

**AC:**
- [ ] Deploys; covered by sprint M (TM.20)
- [ ] Same proxy; sprint Q only adds Citation-side usage

**Depends on:** TM.20

### TQ.11 -- /api/lookup/openalex | Cx: 5 | P1

**Description:** Vercel proxy wrapping OpenAlex. Citation graph enrichment.

**AC:**
- [ ] Deploys; covered by sprint M (TM.21)

**Depends on:** TM.21

### TQ.12 -- Source enrichment flow | Cx: 5 | P1

**Description:** When user creates Source by URL/DOI, auto-enrich with CrossRef + OpenAlex.

**AC:**
- [ ] Enrichment runs on Source create
- [ ] Failure non-blocking
- [ ] Cache prevents duplicate lookups

**Depends on:** TQ.10, TQ.11

### Phase 4: Library + sync + tests

### TQ.13 -- /sources cross-project library | Cx: 5 | P1

**Description:** List all Sources across projects with filters (kind, project, year, language).

**AC:**
- [ ] All filters work
- [ ] Virtual list for ≥ 1k sources
- [ ] Click → source detail

**Depends on:** TI.4

### TQ.14 -- Drive sync (citations) | Cx: 3 | P0

**Description:** Add `citations` to envelope.

**AC:**
- [ ] Round-trip preserves all fields
- [ ] Backward compat handled

**Depends on:** TF.7, TQ.1

### TQ.15 -- Tests | Cx: 5 | P1

**Description:** Vitest on citation key generation, BibTeX parser, bibliography style snapshots.

**AC:**
- [ ] Coverage ≥ 86%
- [ ] Key generation ≥ 95%
- [ ] BibTeX round-trip fixtures

**Depends on:** TQ.7, TQ.9

---

## Sprint enforcement gates (must pass before Sprint R begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — citation key generation ≥ 95%; bibliography rendering snapshots
- [ ] **G-Migrate** — citations store added cleanly
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint R:**

- [ ] Additional bibliography styles (Vancouver, Harvard)?
- [ ] In-text style switching mid-document?
