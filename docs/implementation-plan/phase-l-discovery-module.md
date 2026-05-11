# Phase L — Discovery Module

## Goal

Build a top-level Discovery pillar that finds new academic articles via
a 3-step pipeline (Gemini query optimization → Perplexity Sonar →
Gemini relevance analysis), surfaces them in three sub-tabs (Latest /
Favorites / History), and adapts to user feedback through a project-
scoped log.

## Why this phase

ThesisCraft's Discovery module was the most distinctive feature of the
app. The merged Headway absorbs it but adds: project scoping (vs TC's
single-thesis), 24h Perplexity caching (vs TC's per-click cost),
backoff retry on 429 (vs TC's silent skip), unbounded history
pagination (vs TC's localStorage cap), and integration with the merged
Source/Citation model.

## Prerequisites

- Phase G (Architectural Rebuild)
- Phase H (Multi-Project Workspaces) — projects expose keywords / hypotheses
- Phase I (Source Generalization) — "Add to library" creates `kind: 'article'`
- Phase K (Multi-Provider AI + Perplexity) — Perplexity provider exists

## Deliverables

1. New IDB stores: `discovery_results`, `discovery_cache`,
   `research_feedback`.
2. Top-level `/discovery` route with three sub-tabs (Latest / Favorites
   / History).
3. 3-step search pipeline: Gemini query optimizer (Step 1), Perplexity
   Sonar (Step 2 × 3 parallel), Gemini analyze (Step 3 × N parallel).
4. `DiscoveryCard` component with swipe-to-favorite / swipe-to-dismiss,
   relevance badge, star rating, expand-abstract.
5. Feedback writes — every action emits a `ResearchFeedback` row scoped
   to the active project.
6. Vercel proxy `/api/perplexity/proxy.ts` for CORS bypass.
7. 24h Perplexity cache + cross-batch analysis cache.
8. Cost-mitigation: project-scoped `existingTitles` post-filter (not
   in-prompt), debounce, optional `top5` analysis depth setting.
9. Recent-search history strip (replaces TC's fake notification
   schedule).
10. History pagination (50 per page) and search inside history.
11. "Add to library" creates a `kind: 'article'` Source via the import
    pipeline; "Cite from result" (Phase Q) creates a Citation.

## Task breakdown

- **T1**: Define `DiscoveryResult`, `DiscoveryCacheEntry`,
  `ResearchFeedback` interfaces. Add Dexie migrations.
- **T2**: Vercel proxy `/api/perplexity/proxy.ts` with three JSON
  extraction strategies (port from TC).
- **T3**: Pipeline orchestrator in `src/pillars/discovery/pipeline/`:
  `runSearch(activeProjectId)` runs 3 steps with progress callbacks.
- **T4**: Step 1 prompt builder — embed last 20 feedback log entries +
  project keywords + project description.
- **T5**: Step 2 caller — parallel `Promise.allSettled` over 3 queries.
  Cache lookup before each call. Backoff retry on 429.
- **T6**: Step 3 caller — parallel analyze with cross-batch cache lookup
  (sha1 of title) before each.
- **T7**: `DiscoveryCard` component (port from TC `SearchSuggestionCard`)
  with Framer Motion drag, RelevanceBadge, StarRating, expand,
  external-link buttons.
- **T8**: Three sub-tabs: Latest / Favorites / History. Each is a
  separate route under `/discovery`.
- **T9**: Recent-search history strip (top of Latest), showing last 5
  batches with timestamps and tap-to-view.
- **T10**: History view with pagination (50/page) and search input
  (full-text on title + abstract).
- **T11**: Feedback log writer — `addFeedback(action, result, projectId)`
  helper writes to `research_feedback`.
- **T12**: "Add to library" handler — creates Source with
  `kind: 'article'`, copies abstract/concepts, links to project via
  feedback log.
- **T13**: Settings: `perplexityApiKey`, `discoveryAnalysisDepth`,
  `discoveryCacheTtlH`, `allowExpensiveDiscovery`.
- **T14**: Drive sync envelope: add `discovery_results`,
  `research_feedback`. (Skip `discovery_cache` — local-only by default,
  configurable.)
- **T15**: Tests — Vitest on prompt builders, cache key generation,
  dedup logic. Playwright e2e for "search → favorite a result → search
  again → see it in Favorites" with mocked Perplexity.

## Acceptance criteria

- Tap "Search Now" with `perplexityApiKey` set runs the full 3-step
  pipeline within 30 seconds for a typical query.
- Same query within 24h hits the cache (<1 second response).
- Step 2 retries on 429 (max 2 retries, exponential backoff).
- Heart / dismiss / rate / add-to-library actions emit feedback log
  rows scoped to the active project.
- The next Step 1 prompt embeds the last 20 feedback rows.
- "Add to library" creates a `kind: 'article'` Source viewable in
  Library.
- History pagination shows 50 per page; search inside history works.
- No-project mode: search uses global keywords; feedback log is
  global.
- Tests pass; cost benchmarks: average search costs ≤ 5 paid calls
  (vs TC's 14).

## Effort estimate

- T-shirt: **L**
- Person-weeks: **3–4**

## Risks & unknowns

- **Perplexity API stability** — has been changing. Cache layer makes
  outages tolerable for repeated queries.
- **Hallucinated articles** — Perplexity sometimes invents plausible
  citations. Phase M's CrossRef enrichment flags these with
  `_unverified: true`. For Phase L MVP, surface a "verify DOI" button
  per result.
- **Feedback prompt blow-up** — 20 log entries × full text could exceed
  Step 1 prompt budget. Truncate concepts to 5 each and titles to 100
  chars.
- **Project scope leakage** — make sure feedback queries always filter
  by `projectId`. Test: project A search shouldn't see project B
  feedback.

## Out of scope

- Pre-computed daily digest (Phase X)
- Embeddings / semantic search (Phase X optional)
- Citation creation from Discovery card — Phase Q ("Cite this" button
  works after Q lands)
- DOI auto-verification — Phase M (this phase shows a manual button)

## Decision points (revisit before Phase O)

- ⚠ Default `discoveryAnalysisDepth: 'all' | 'top5'` — Phase L ships
  `'all'`, Phase X may flip default to `'top5'` if cost analytics
  show it's better.
- ⚠ Should the recent-search strip be persistent across page navigations
  or scoped per /discovery visit? Decision: persistent; reset on logout.
