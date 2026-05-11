# Sprint L: Discovery Module — Perplexity 3-step pipeline, sub-tabs, feedback loop

> One task per T-item in `docs/implementation-plan/phase-l-discovery-module.md`.
> Search the web for relevant academic papers via Perplexity, organize into Latest/Favorites/History, learn from user feedback.

### Phase 1: Data + pipeline

### TL.1 -- DiscoveryResult + DiscoveryCacheEntry interfaces | Cx: 5 | P0

**Description:** Define `DiscoveryResult`, `DiscoveryCacheEntry` zod schemas. Dexie stores: `discovery_results`, `discovery_history`, `discovery_feedback`, `discovery_cache`.

**AC:**
- [ ] zod schemas + TS types
- [ ] Dexie migration adds stores
- [ ] Validators cover happy + malformed inputs
- [ ] Cache TTL set to 24h

**Depends on:** TG.4, TI.1

### TL.2 -- Vercel proxy /api/perplexity/proxy (3 JSON strategies) | Cx: 5 | P0

**Description:** Build on sprint K's proxy. Ensure 3 JSON extraction strategies + `validateResult` are used in the Discovery flow.

**AC:**
- [ ] Reused from sprint K
- [ ] Strategy coverage verified
- [ ] Discovery-specific schema validated

**Depends on:** TK.9, TK.8

### TL.3 -- Pipeline orchestrator (3-step) | Cx: 13 | P0

**Description:** `src/pillars/discovery/pipeline/`: Step 1 = generate 3 search queries from project keywords + feedback log. Step 2 = parallel `Promise.allSettled` over 3 queries to Perplexity. Step 3 = parallel analyze with cross-batch cache lookup.

**AC:**
- [ ] All 3 steps modular and individually testable
- [ ] `Promise.allSettled` ensures partial-failure tolerance
- [ ] Cache lookup reduces redundant API calls
- [ ] Vitest covers pipeline with mocked Perplexity

**Depends on:** TL.2

### TL.4 -- Step 1 prompt builder | Cx: 5 | P1

**Description:** Embed last 20 feedback log entries + project keywords. Output JSON with 3 distinct queries.

**AC:**
- [ ] Prompt deterministic for same inputs
- [ ] Feedback log truncated to 20 entries
- [ ] Vitest snapshot of generated prompts
- [ ] Handles empty feedback log gracefully

**Depends on:** TL.3

### TL.5 -- Step 2 caller (parallel queries) | Cx: 5 | P1

**Description:** Parallel `Promise.allSettled` over 3 queries. Aggregate results.

**AC:**
- [ ] Partial failures don't abort
- [ ] Latency under 30s for 3 queries
- [ ] Vitest with mocked Perplexity
- [ ] Errors surface in result metadata

**Depends on:** TL.3

### TL.6 -- Step 3 caller (cross-batch cache lookup) | Cx: 8 | P1

**Description:** Parallel analyze with cross-batch cache. Deduplicate results by canonical URL.

**AC:**
- [ ] Cache hits return instantly
- [ ] Dedup correct on URL + DOI
- [ ] Vitest covers cache hit/miss paths

**Depends on:** TL.5

### Phase 2: UI + sub-tabs + history

### TL.7 -- DiscoveryCard component | Cx: 5 | P1

**Description:** Port from ThesisCraft `SearchSuggestionCard`. Render title, authors, year, source, relevance, abstract.

**AC:**
- [ ] All 6 fields render
- [ ] Card responsive on mobile
- [ ] Click-to-expand for abstract
- [ ] Accessible (aria labels on actions)

**Depends on:** TL.1

### TL.8 -- Three sub-tabs (Latest / Favorites / History) | Cx: 5 | P1

**Description:** Each is a virtual list of `DiscoveryCard`s.

**AC:**
- [ ] All 3 tabs render
- [ ] Virtual scrolling for ≥ 1k items
- [ ] Tab state persists per session
- [ ] Empty states per tab

**Depends on:** TL.7

### TL.9 -- Recent-search history strip | Cx: 3 | P2

**Description:** Top of Latest, showing last 5 distinct queries.

**AC:**
- [ ] Shows last 5
- [ ] Click re-runs query
- [ ] Persists across reload

**Depends on:** TL.8

### TL.10 -- History view (pagination + search) | Cx: 5 | P2

**Description:** Pagination (50/page) + search input.

**AC:**
- [ ] 50-per-page pagination
- [ ] Search filters by title/abstract
- [ ] Empty result state

**Depends on:** TL.8

### Phase 3: Feedback + add-to-library + sync + settings

### TL.11 -- Feedback log writer | Cx: 3 | P1

**Description:** `addFeedback(action, result, projectId)`. Actions: like / save / dismiss / open / add.

**AC:**
- [ ] All 5 actions logged
- [ ] Log capped (oldest 100 retained)
- [ ] Feedback influences next pipeline run (verify in TL.4 snapshot)

**Depends on:** TL.1

### TL.12 -- Add to library handler | Cx: 5 | P1

**Description:** Creates `Source` with `kind: 'article'` from a DiscoveryResult.

**AC:**
- [ ] Article created with full metadata (DOI, journal, year)
- [ ] Auto-coerces to sprint I's Source schema
- [ ] Library refreshes immediately
- [ ] Duplicate detection (by DOI or URL)

**Depends on:** TI.4, TL.7

### TL.13 -- Settings: Discovery | Cx: 3 | P2

**Description:** `perplexityApiKey`, `discoveryAnalysisDepth`, default sort, language filter.

**AC:**
- [ ] All settings persist
- [ ] Validation on numeric inputs

**Depends on:** TK.7

### TL.14 -- Drive sync envelope extension | Cx: 5 | P0

**Description:** Add `discovery_results`, `discovery_history`, `discovery_feedback`, `discovery_cache` to envelope.

**AC:**
- [ ] Round-trip preserves all 4 stores
- [ ] Backward compat: missing fields handled
- [ ] Vitest covers envelope

**Depends on:** TH.11, TL.1

### TL.15 -- Tests | Cx: 5 | P1

**Description:** Vitest on prompt builders, cache key generation, validators. Playwright e2e: project keywords → run pipeline → see results → add to library → article appears.

**AC:**
- [ ] Unit coverage ≥ 86%
- [ ] e2e green
- [ ] Fixtures cover thesis + article projects

**Depends on:** TL.12

---

## Sprint enforcement gates (must pass before Sprint M begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Security** — Perplexity key never logged server-side
- [ ] **G-Tests** — pipeline + parser ≥ 90% coverage
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint M:**

- [ ] Cache TTL of 24h sufficient? (May want per-result freshness)
- [ ] Feedback log retention policy (currently last 100)
