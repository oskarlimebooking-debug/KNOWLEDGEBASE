# Sprint W: Knowledge Plus + Research Graph

> One task per T-item in `docs/implementation-plan/phase-w-knowledge-plus.md` (Q1–Q12 in source doc + research-graph extension).
> Extract concepts, link across library, navigate by concept. Build research graph from citations + hypotheses + concepts.

### Phase 1: Concept extraction + normalization

### TW.1 -- Concept extraction | Cx: 13 | P0

**Description:** AI extracts structured concepts per chapter: `{ id, name, kind, salience }`. Cache `concepts_<chapterId>`.

**AC:**
- [ ] 5–20 concepts per chapter
- [ ] Salience scored 0–1
- [ ] Cache works
- [ ] Vitest snapshots

**Depends on:** TB.1

### TW.2 -- Concept normalization | Cx: 8 | P1

**Description:** Cluster duplicates across chapters / sources. Use embedding similarity (deferred to sprint X) or string-fuzzy.

**AC:**
- [ ] "Photosynthesis" and "photosynthesis" merge
- [ ] User can split / merge manually
- [ ] Idempotent on re-run

**Depends on:** TW.1

### Phase 2: Knowledge graph

### TW.3 -- Knowledge graph view | Cx: 13 | P1

**Description:** Force-directed graph (D3 or Cytoscape). Nodes = concepts; edges = co-occurrence in chapters.

**AC:**
- [ ] Renders 200+ nodes smoothly
- [ ] Zoom + pan
- [ ] Click node → list of chapters
- [ ] Mobile-friendly (or graceful degradation)

**Depends on:** TW.2

### TW.4 -- Concept search | Cx: 5 | P1

**Description:** Search by concept name; results show chapters where concept is salient.

**AC:**
- [ ] Fuzzy search
- [ ] Sort by salience
- [ ] Integrates with sprint T's ⌘K palette

**Depends on:** TT.1, TW.2

### TW.5 -- Side-by-side comparison | Cx: 8 | P2

**Description:** Pick 2 sources / chapters → split view → AI commentary on agreements / disagreements.

**AC:**
- [ ] Split view works on mobile + desktop
- [ ] AI commentary cached per pair
- [ ] Export commentary as PDF

**Depends on:** TW.1

### TW.6 -- Reading paths (AI-recommended) | Cx: 8 | P2

**Description:** Recommend an ordered reading path for a given concept across library.

**AC:**
- [ ] Path makes pedagogical sense (manual A/B)
- [ ] User can save paths
- [ ] Cached per concept

**Depends on:** TW.2

### TW.7 -- "What does X think about Y?" query | Cx: 5 | P2

**Description:** Multi-book Ask focused on author X's view on concept Y.

**AC:**
- [ ] Cross-source query reaches sprint S's batch chat
- [ ] Cites sources used

**Depends on:** TS.7

### Phase 3: Customization + xrefs

### TW.8 -- Custom personality builder | Cx: 13 | P2

**Description:** User creates personalities for the feed (sprint D). Stored in IDB with name + voice description + image hint.

**AC:**
- [ ] CRUD on custom personalities
- [ ] Feed prompt builder accepts custom + default mix
- [ ] Drive sync via settings whitelist
- [ ] User can disable defaults

**Depends on:** TD.1

### TW.9 -- AI prompt playground | Cx: 5 | P2

**Description:** Settings → test arbitrary prompts against the active provider. Show response + token usage.

**AC:**
- [ ] All providers (Gemini/Merlin/Junia/DocAnalyzer/Perplexity) selectable
- [ ] Response renders with sanitization
- [ ] History of last 20 prompts

**Depends on:** TK.1

### TW.10 -- Chapter-to-chapter cross-references | Cx: 8 | P2

**Description:** AI detects when chapter A references chapter B (in same or different book). Surface in chapter view.

**AC:**
- [ ] Detection accuracy ≥ 70% (manual A/B)
- [ ] Cached per chapter pair
- [ ] Click navigates to referenced chapter

**Depends on:** TW.1

### TW.11 -- Library cards on concept | Cx: 5 | P2

**Description:** Library can filter / sort by concept saliency.

**AC:**
- [ ] New view: "by concept" sidebar
- [ ] Concept chips on each source card
- [ ] Mobile-friendly

**Depends on:** TW.2

### TW.12 -- Concept timeline | Cx: 5 | P2

**Description:** Timeline visualizing when each concept first appears + frequency across library.

**AC:**
- [ ] All concepts on a horizontal axis
- [ ] Click concept → its life across library
- [ ] Export as image

**Depends on:** TW.3

### Phase 4: Research Graph extension (post-merger)

### TW.13 -- Research Graph (citations + hypotheses + concepts) | Cx: 21 | P0

**Description:** Layer the knowledge graph with citations (sprint Q) and hypotheses (sprint H). Edges typed (supports / contradicts / cites).

**AC:**
- [ ] All 3 entity types displayed
- [ ] Edge typing visualized (colors)
- [ ] Click hypothesis → connected sources via citations
- [ ] Sprint X (Research Mode Suite) consumes this graph

**Depends on:** TW.3, TQ.1, TH.1

---

## Sprint enforcement gates (must pass before Sprint X begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — concept extraction snapshots; normalization idempotency
- [ ] **G-Manual** — 5-source library: graph renders, search hits, paths make sense
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint X:**

- [ ] Embedding provider for normalization (deferred to X)
- [ ] Research Graph: standalone visualization or embedded in Knowledge Graph
