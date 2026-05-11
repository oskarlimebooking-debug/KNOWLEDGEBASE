# 27 — Discovery Module

The Discovery view is a top-level pillar (sibling of Library and Writing)
that finds new academic articles by chaining **Gemini** (for query
optimization and relevance analysis) with **Perplexity Sonar** (for
retrieval). It surfaces results in three sub-tabs (Latest / Favorites /
History) and feeds user actions into a feedback loop that biases future
searches.

> Implemented in Phase L (`implementation-plan/phase-l-discovery-module.md`).
> Adopted from ThesisCraft's discovery module with cost mitigations
> (caching, dedup, batch dedup), proper error retry, and integration with
> the merged app's project model.

---

## How it fits in the merged app

Discovery is **scoped to the active project**:

- It reads the project's `keywords` and last 20 entries of
  `research_feedback` (filtered by `projectId`) for query generation.
- "Add to library" creates a library Source with
  `kind: 'article'` and a backreference to the project.
- In **no-project mode**, Discovery uses a global `searchKeywords`
  setting and a global feedback log.

---

## The three-step pipeline

```
                ┌─────────────────────────────────────┐
                │  Tap "Search Now"                   │
                └────────────┬────────────────────────┘
                             │ batchId = `batch_<ts>_<rand>`
                             ▼
   ┌───────────────────────────────────────────────────┐
   │ Step 1/3 — Gemini: optimize search queries        │
   │ Inputs:                                           │
   │   - active project's keywords                     │
   │   - last 20 feedback log entries (favorites,      │
   │     dismissals, ratings, library adds)            │
   │   - thesis topic / project description            │
   │ Output: { queries: [q1, q2, q3] }                 │
   │ JSON mode, temperature 0.8                        │
   └────────────┬─────────────────────────────────────┘
                ▼
   ┌───────────────────────────────────────────────────┐
   │ Step 2/3 — Perplexity Sonar (parallel × 3)        │
   │ existingTitles = library titles ∪ recent results  │
   │ Promise.allSettled([                              │
   │   /api/perplexity/proxy {q1, existingTitles},     │
   │   /api/perplexity/proxy {q2, ...},                │
   │   /api/perplexity/proxy {q3, ...}                 │
   │ ])                                                │
   │ → flatten, dedupe by normalized title             │
   └────────────┬─────────────────────────────────────┘
                ▼
   ┌───────────────────────────────────────────────────┐
   │ Step 3/3 — Gemini: analyze each unique result     │
   │ Promise.allSettled(unique.map(a =>                │
   │   callAI(analysisPrompt(a), apiKey, ...)          │
   │ ))                                                │
   │ Falls back to {relevanceScore: 50, ...} on error  │
   └────────────┬─────────────────────────────────────┘
                ▼
   build DiscoveryResult[] {
     id, projectId, title, authors, abstract, journal, year, url, pdfUrl,
     relevanceScore, relevantConcepts, whyRelevant, hypothesisMatches,
     isFavorite: false, rating: undefined, dismissed: false,
     batchId, dateFound: now
   }
                ▼
   sort by relevanceScore desc
   dbPut('discovery_results', ...)
```

### Loading-step UI

Three skeleton cards render below the search button, with a step indicator:

- `"Step 1/3: Generating optimized queries…"`
- `"Step 2/3: Searching academic databases…"`
- `"Step 3/3: Analyzing N articles…"`

### Failure modes per step

| Step | Failure | Behaviour |
|---|---|---|
| 1 | Gemini returns invalid JSON | Fallback to single query: `keywords.join(" OR ")` |
| 1 | Gemini API key missing | Toast `"Add your Gemini key in Settings"` and abort |
| 2 | Perplexity 429 | **Exponential backoff retry** (Phase L improves on TC's silent skip), max 2 retries |
| 2 | Some queries fail | Continue with successful ones (`Promise.allSettled`) |
| 2 | Zero unique results | Toast `"No new articles found. Try refining keywords."` |
| 3 | Per-article analyze fails | Default `{relevanceScore: 50, keyConcepts: [], whyRelevant: ""}` |

---

## Data model

### `discovery_results` IDB store (new in Phase L)

```ts
interface DiscoveryResult {
  id: string;                   // "sr_<ts>_<i>_<rand>"
  projectId: string | null;     // null = no-project search
  title: string;
  authors: string;
  abstract: string;
  journal?: string;
  year?: number;
  url: string;
  pdfUrl?: string;
  relevanceScore: number;       // 0-100
  relevantConcepts: string[];
  whyRelevant: string;
  hypothesisMatches?: string[]; // e.g. ["H1", "H3"] (only when project has hypotheses)
  isFavorite: boolean;
  rating?: number;              // 1-5
  dismissed: boolean;
  addedToLibrary: boolean;
  batchId: string;
  dateFound: string;
}
```

Note: ThesisCraft used `localStorage` (5–10 MB quota); Headway uses IDB
which is virtually unlimited.

### `discovery_cache` IDB store (new in Phase L)

```ts
interface DiscoveryCacheEntry {
  id: string;                   // hash(query + projectId) — cache key
  query: string;
  projectId: string | null;
  results: PerplexityRawResult[];
  cachedAt: string;
  ttl: number;                  // 24h default
}
```

Phase L caches Perplexity responses for 24 h to dramatically reduce cost vs
ThesisCraft's per-click pattern. The cache is keyed by query + project so
two projects with overlapping keywords don't share noise.

### Analysis cache

Article analysis results are cached in the existing `generated` store with
key pattern `discovery_analysis_<sha1(title)>` and `type: 'discovery_analysis'`.
A given article URL is analyzed once and reused across batches and
projects.

---

## Three sub-tabs

### Latest

Shows the **most recent non-dismissed batch** for the active project.

```ts
const latestBatchId = useMemo(() => {
  const candidates = results
    .filter(r => r.projectId === activeProjectId && !r.dismissed);
  return candidates[0]?.batchId ?? null;
}, [results, activeProjectId]);
```

Above the cards: a recent-search history strip showing the last 5 batches
with timestamps and one-tap "view this batch" buttons. (TC had a fake
notification schedule decoration — Headway replaces it with this useful
strip.)

### Favorites

Filters to `r.isFavorite === true` for the active project. Sortable by
`relevance` / `rating` / `date`. Sort selection is persisted in settings.

### History

All non-dismissed results ever found, grouped by date. Headway adds:
- **Pagination** (50 per page; TC let history grow unbounded)
- **Search inside history** (full-text on title + abstract; piggybacks on
  Phase T's full-text search index)
- **Dismissed view toggle** (default hides; toggle to show at 40 % opacity)

---

## Per-result actions and feedback loop

`DiscoveryCard` (Headway port of TC's `SearchSuggestionCard`) exposes:

| Callback | Persists | FeedbackLog action |
|---|---|---|
| `onFavorite(id)` | toggles `isFavorite` | `"favorite"` (only when toggling on) |
| `onRate(id, n)` | sets `rating` | `"rate"` with rating |
| `onDismiss(id)` | sets `dismissed: true` | `"dismiss"` |
| `onAddToLibrary(r)` | creates Source `kind:'article'`, opens it | `"add_to_library"` |
| `onOpenUrl(url)` | external link via `window.open(url, '_blank', 'noopener,noreferrer')` | none |
| `onCite(r, sectionId)` | creates Citation linking to current section | `"cite"` (Phase Q) |

All `research_feedback` rows include `projectId` so the next search reads
only this project's history. See
[`31-research-feedback-loop.md`](31-research-feedback-loop.md) for prompt
shape and schema.

### Drag mechanics (mobile)

Right swipe → favorite. Left swipe → dismiss. Threshold ≈150 px. Visual
feedback via `transform`, `opacity`, and indicator pill. Identical to TC's
implementation.

---

## Cost mitigations vs ThesisCraft

ThesisCraft costs ≈14 paid API calls per search button press (1 Gemini
generate + 3 Perplexity + ~10 Gemini analyze). Headway reduces this:

1. **24 h Perplexity cache** keyed on `(query, projectId)` — repeated
   searches in the same window are free.
2. **Cross-batch analysis cache** in `generated` — articles seen before
   skip the Gemini analyze call (lookup by `sha1(title)`).
3. **Dedup against `existingTitles`** does **not** stuff the Perplexity
   prompt for libraries >50 articles; instead, post-search filter by
   normalized title (TC pattern wastes tokens on huge libraries).
4. **Batch debounce**: a 2-second cooldown on the search button prevents
   accidental double-clicks. Server side: a per-key 60-second window with
   a soft cap of 4 batches/min.
5. **Optional paid-tier flag** (`settings.allowExpensiveDiscovery`):
   when off, Step 3 only analyzes the top 5 by Perplexity-supplied hint,
   not all unique articles. Cuts cost by ~50 %.

Effective monthly cost (3 daily searches, average library):
- TC pattern: ~1300 calls/month
- Headway pattern: ~250-400 calls/month (66–80 % reduction)

---

## Vercel proxy

`/api/perplexity/proxy.js` (new in Phase K — Multi-Provider AI):

- Forwards POST to `https://api.perplexity.ai/chat/completions` with the
  user's `perplexityApiKey` from request body.
- Returns the raw Perplexity response (no transformation).
- Handles CORS (Perplexity's API doesn't set permissive CORS headers).
- Sets `Cache-Control: no-store` (the IDB cache is the only cache).

Three JSON-extraction strategies (port of TC's logic):
1. `JSON.parse(content)` directly (handles `{results:[]}` and `{articles:[]}` wrappers)
2. Match a markdown code fence ` ```json ... ``` ` and parse inside
3. Regex-extract the first `[...]` block

Each item runs through `validateResult()` to coerce types and drop entries
without a non-empty `title`.

---

## Settings

| Key | Type | Default | Meaning |
|---|---|---|---|
| `perplexityApiKey` | string | "" | Required for Discovery |
| `discoveryAnalysisDepth` | `"all" \| "top5"` | "all" | Cost lever (Step 3 fan-out) |
| `discoveryCacheTtlH` | number | 24 | Perplexity cache TTL in hours |
| `allowExpensiveDiscovery` | bool | true | Master switch (off = top5 only) |

---

## Notable behaviours

- **No DOI verification** at MVP. Phase M adds CrossRef/OpenAlex enrichment
  to flag potentially fabricated articles (Perplexity occasionally
  hallucinates plausible-but-fake citations).
- **Add-to-library is non-destructive**: the result row stays in History
  (with `addedToLibrary: true` flag) so the user can see what they've
  already imported.
- **Favorites and history are project-scoped** (filter by `projectId`); a
  result favorited in one project doesn't appear in another.

---

## Continue reading

- Project & feedback context: [`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md), [`31-research-feedback-loop.md`](31-research-feedback-loop.md)
- Source entity that "Add to library" creates: [`32-source-vs-book.md`](32-source-vs-book.md)
- Perplexity provider integration: [`16-ai-providers.md`](16-ai-providers.md)
- Vercel proxy: [`21-vercel-proxies.md`](21-vercel-proxies.md)
