# Phase X — Research Mode Suite

## Goal

Layer advanced research tooling on top of the merged app: hypothesis
tracker, claim verifier, evidence map, supervisor share link, and
optional embeddings-based semantic search.

## Why this phase

After Phase Q (Citations) and Phase W (Knowledge+ / Research Graph) ship,
the data is rich enough to power higher-level research workflows:
- "How well-supported is each of my hypotheses by my cited sources?"
- "Paste a claim from my draft — find supporting / contradicting sources
  in my library."
- "Generate an evidence map of my project's argument."
- "Share my project read-only with my supervisor for feedback."

These features make Headway a serious research tool, not just a writing
tool with citations.

## Prerequisites

- Phase G (Architectural Rebuild)
- Phase H (Multi-Project Workspaces)
- Phase L (Discovery)
- Phase O (Writing Hub)
- Phase Q (Citations)
- Phase W (Knowledge Plus + Research Graph)

## Deliverables

1. **Hypothesis tracker** — view per-project: each hypothesis shown with
   evidence count (citations matching it), a strength bar, and a list
   of supporting / contradicting sources.
2. **Claim verifier** — input a claim from a draft; AI searches library
   + cited sources for supporting / contradicting evidence; surfaces
   matches with snippets and citation suggestions.
3. **Evidence map** — visual map: hypotheses as central nodes, citations
   as supporting nodes, contradiction edges in red. Force-directed
   layout (uses Phase W's research graph data).
4. **Pre-computed daily research digest** — overnight job runs Discovery
   once per active project, surfaces 5 best results in the dashboard
   without per-click cost.
5. **Optional embeddings-based semantic search** — gated by setting toggle
   (off by default; opt-in for users with budget for Voyage / Cohere /
   Gemini Embeddings).
6. **Supervisor share link** (token-based read-only) — minimal MVP:
   generates a hash of project + sections + citations, hosts on a
   throwaway Vercel route, expires after 30 days. (Phase X first cut
   does NOT include comments — that's Phase Y.)
7. **Research dashboard** view at `/research/:projectId` consolidating
   hypothesis status, evidence map preview, recent feedback,
   recent citations.

## Task breakdown

- **T1**: Hypothesis tracker view — count citations per hypothesis (read
  `hypothesisMatches` from Discovery results, plus citations whose
  section relates to the hypothesis). Strength bar = supporting count
  / total cited.
- **T2**: Claim verifier UI — modal with claim textarea, "Find evidence"
  button → AI call with library + project context → results panel.
- **T3**: Claim verifier prompt: "You are a research assistant. Given
  the claim {claim}, search these sources for supporting and
  contradicting evidence: {sources}. Return JSON with `supporting:
  [{sourceId, snippet, page}]` and `contradicting:
  [{sourceId, snippet, page}]`."
- **T4**: Evidence map visualization (uses Phase W's force-directed
  graph component): hypotheses as filled nodes, citations as small
  nodes, contradiction edges colored differently.
- **T5**: Daily digest scheduler — Vercel cron-like (or per-tab on
  app launch) runs Discovery for each active project once per day.
  Results stored in `discovery_results` with a `_daily: true` flag.
- **T6**: Daily digest UI — surface top 5 by relevance on the project
  hub.
- **T7**: Embeddings provider plugin — implement `EmbeddingsPlugin`
  contract; ship Voyage and Gemini Embeddings as built-in options.
  Settings toggle `embeddingsProvider` (default `'none'`).
- **T8**: Embedding indexer worker — when enabled, embeds new sources +
  citations in the background. Stores embeddings in
  `generated` with `type: 'embedding'`.
- **T9**: Semantic search route in Discovery — when embeddings enabled,
  add a "Semantic" sub-tab that does cosine similarity on user query.
- **T10**: Supervisor share link — generate hash, write a tiny
  read-only HTML page (project + sections + citations rendered) to
  Vercel storage; expires after 30 days. Generate a one-time URL.
- **T11**: Research dashboard `/research/:projectId` consolidating:
  hypothesis status, evidence map preview, daily digest, recent
  feedback log entries, recent citations added.
- **T12**: Drive sync extensions for embedding cache (large; opt-in to
  sync).
- **T13**: Tests — Vitest unit tests on hypothesis strength calculation,
  claim verifier prompt builder, embedding similarity. Playwright e2e
  for "create project → cite 5 sources → check hypothesis strength →
  verify claim → see supporting evidence".

## Acceptance criteria

- Hypothesis tracker shows accurate per-hypothesis counts derived from
  citations and Discovery results.
- Claim verifier returns supporting + contradicting sources with
  snippets within 30 seconds for a project with ~50 cited sources.
- Evidence map renders without lag for ~200 nodes.
- Daily digest produces 5 fresh results once per day per project,
  configurable.
- Embeddings opt-in works without breaking existing flow when off.
- Supervisor share link works in incognito (no auth required for
  reader); expires after 30 days.
- Tests pass.

## Effort estimate

- T-shirt: **L**
- Person-weeks: **4–5**

## Risks & unknowns

- **Daily digest cost** — Discovery × N projects × N days; cap at one
  digest per project per day, opt-in toggle.
- **Embeddings cost** — Voyage free tier covers thousands of embeddings
  per month, but a large library + frequent re-embedding could hit
  limits. Default to indexing only on user trigger ("Embed all sources
  now").
- **Supervisor share link security** — token-only access, no auth. If
  the link leaks, anyone with it can read. Acceptable for MVP; Phase Y
  adds proper auth.
- **Claim verifier hallucinations** — AI may invent evidence that's not
  in the source. Always surface the source's snippet and let the user
  click through to verify.

## Out of scope

- Comments on supervisor share — Phase Y
- Auth-based collaboration — Phase Y
- Pre-computed embedding clusters / "topics" — Phase Y
- AI-suggested counter-arguments to a draft section — Phase Y candidate

## Decision points

- ⚠ Default `embeddingsProvider` value — Phase X ships `'none'`. Make
  the opt-in CTA visible enough.
- ⚠ Supervisor share — should it allow comments? Phase X first cut: no
  (read-only). Phase Y adds.
- ⚠ Daily digest opt-in or default-on? Decision: default-on but
  conservatively (1 search per project per day) since cost is bounded.
