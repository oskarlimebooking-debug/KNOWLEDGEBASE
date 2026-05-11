# Phase W — Knowledge Plus + Research Graph

> **Tagline:** Treat your library as a graph, not a list. **Plus**: research-graph layered on hypotheses, citations, and concepts.

## Goal

Extract structured concepts from every chapter, link related chapters
across the library, and let the user navigate via concept rather than
title. Add side-by-side source comparison, AI-recommended reading
paths, and a custom-personality builder for the feed.

**Post-merger extensions**: build a **Research Graph** layered on top
of the knowledge graph that connects citations, hypotheses, and concepts.
This unlocks Phase X's hypothesis tracker and evidence map.

## Why this phase / rationale

By Phase U, the user has potentially hundreds of sources and thousands
of chapters, plus citations and hypotheses across multiple projects.
Linear browsing breaks down. The library wants a **second dimension**:
the conceptual axis. Where do my notes on "emergence" cluster? Which
two sources disagree most on "free will"? What should I read next
given what I just finished?

The research graph extension layers project data: which sources cite
each other (transitively), which sections cite which sources, which
hypotheses are supported / contradicted by which citations.

This is the phase that turns the app from "place I keep books" into
"thinking partner" and "research dashboard".

## Prerequisites

- Phases A–U (everything else; this phase consumes the entire library
  and project data).
- Phase G's worker infra (heavy AI passes are background tasks).
- Phase Q (Citations) — research graph reads citation data.

## Deliverables

- Concept extraction across all chapters (background AI pass).
- Knowledge graph view (force-directed layout).
- Concept search ("show all chapters tagged 'emergence'").
- Side-by-side **source** comparison view (post-Phase-I generalization).
- AI-recommended reading paths.
- Custom personality builder for the feed.
- AI prompt playground (tune custom prompts on a fixture chapter).
- Chapter-to-chapter cross-references.
- "What does X think about Y?" — query a specific author's chapters
  about a specific topic.

### NEW post-merger: Research Graph

- **Research graph data model**: nodes = sources + concepts +
  hypotheses + sections; edges = citations (source → section),
  hypothesis-mentions (hypothesis → section), concept-overlap
  (source ↔ source), citation-relations (source → source via OpenAlex).
- **Research graph visualization** — force-directed, layered (or
  faceted by edge type).
- **Per-project view**: hypotheses as central nodes, citations as
  spokes, supporting/contradicting edges color-coded.
- **Research path generator**: given a project's hypotheses, AI
  proposes a reading order across cited sources.
- **Citation network**: which sources cite which (from OpenAlex), shown
  as a separate edge layer.
- This data is the input that Phase X's hypothesis tracker, claim
  verifier, and evidence map consume.

## Task breakdown

### Q1 — Concept extraction

Background worker pass:
- For each chapter, prompt the AI to extract 5–10 concepts:
  ```json
  { "concepts": [
      { "name": "emergence",
        "category": "philosophy",
        "definition": "...",
        "weight": 0.85 } ] }
  ```
- Cache as `concepts_<chapterId>`.

Run on all chapters lazily (when the user opens a chapter or via a
"Re-index library" button in settings).

### Q2 — Concept normalization

Variants of the same concept ("emergence" / "emergent property" /
"emergent behavior") should collapse. Use AI for normalization:
- Periodically batch-run an alignment pass that asks "are these the
  same concept?".
- Build a canonical concept list per library.

### Q3 — Knowledge graph view

A new view: 🕸 Library Graph.

Force-directed layout (D3-force or pixi.js for performance):
- Nodes = chapters.
- Edges = shared concepts (weight by overlap count).
- Node size = "importance" (degree centrality or content length).
- Color = book.

Interactions:
- Hover a node → see chapter title + top concepts.
- Click → open chapter.
- Filter by concept ("show only nodes touching 'emergence'").
- Zoom / pan.

Worker-driven layout (Comlink) to keep main thread smooth.

### Q4 — Concept search

Cmd/Ctrl+K palette extension:
- Typing matches both titles and concepts.
- Concept results show as a special row "[Concept] emergence (43
  chapters)".
- Click → list of all chapters tagged with that concept.

### Q5 — Side-by-side comparison

Open two books side by side. UI:
- Two columns, one chapter list each.
- Click a chapter on the left, then a chapter on the right.
- Bottom pane: AI synthesis of how the two compare on the shared
  concepts.

Cache: `compare_<chapter1>_<chapter2>` (canonical sorted ID order).

### Q6 — Reading paths

"What should I read next?" feature.

Inputs:
- User's recently completed chapters.
- Concepts that appear in those chapters.
- Concepts that appear in unread chapters.

Algorithm:
1. Compute the user's "concept profile" (top 20 concepts by exposure).
2. Find unread chapters with high overlap.
3. Order by AI-judged "natural progression" (an LLM call: "given
   what they've read, what's the next logical step?").

UI: a "Recommended for you" section on the library home, refreshed
weekly.

### Q7 — "What does X think about Y?" query

Multi-book chat extension:
- User specifies an author (e.g. "Yuval Noah Harari").
- App finds all chapters from books by that author.
- User asks a question.
- AI answers with citations to specific chapters.

Falls out naturally from the Phase L batch chat infrastructure.

### Q8 — Custom personality builder

Phase D ships 7 hard-coded personalities. Let users add their own:

Settings → Feed → Personalities → "Add Personality":
- Name (e.g. "Carl Sagan style").
- Voice description prompt.
- Username pool.
- Image style hint.
- Sample post examples (used as few-shot in the feed prompt).

Stored as `custom_personalities` setting (an array). The feed prompt
template iterates over both built-in and custom personalities.

### Q9 — AI prompt playground

A new settings section: 🧪 Playground.

UI:
- Pick a fixture chapter from the library.
- Pick a generator (Summary / Quiz / Feed / etc.).
- Edit the prompt in a textarea.
- "Run" button generates the output.
- Side-by-side comparison: current saved prompt vs draft prompt.
- "Save as default" persists the override.

This is a power-user feature for refining custom prompts.

### Q10 — Chapter-to-chapter cross-references

Inline links: tap a concept in the Read view → popover with "Other
chapters mentioning this concept".

Implementation: the Phase Q1 concept extraction makes this trivial —
just look up other chapters with the same concept.

### Q11 — Library cards on concept

A new dimension in the library: filter by concept instead of by tag.

URL routes: `/library/concept/<concept-slug>` shows all chapters
matching.

### Q12 — Concept timeline

For non-fiction: see how a concept evolves across chapters (a graph
showing concept weight over chapter index in a single book).

Useful for tracking how a book builds an argument.

## Acceptance criteria

- [ ] Concept extraction runs on a 50-chapter book and produces
      reasonable concepts.
- [ ] Knowledge graph renders for the user's whole library without
      slowing the UI.
- [ ] Concept search returns results within 200 ms.
- [ ] Comparison view produces a useful synthesis between two
      chapters.
- [ ] Reading paths surface plausible next reads.
- [ ] Custom personality builds successfully and posts feel
      distinct in voice.
- [ ] Prompt playground lets the user A/B test prompts.
- [ ] Cross-references in the Read view work.

## Effort estimate

- **T-shirt:** L
- **Person-weeks:** 4–6
- **Critical path:** concept extraction quality + graph layout
  performance.

## Risks & unknowns

- **Concept extraction cost** — running a pass on a 100-book library
  is hundreds of API calls. Make it explicit and gradual.
- **Concept normalization quality** — variants are tricky.
- **Graph performance** — D3-force breaks down past ~5,000 nodes.
  Use pixi.js or sigma.js for larger libraries; or aggregate to
  book-level edges past a threshold.
- **AI hallucination in recommendations** — surface confidence,
  let user dismiss.
- **Prompt playground misuse** — bad custom prompts can produce bad
  generations. Always offer "Reset to default".

## Out of scope

- Real-time multi-user collaboration on the graph (Phase R).
- Public concept dictionaries / shared knowledge graphs (Phase R).
- Auto-generation of book summaries by topic (a different product).

## Decision points before Phase R

- [ ] Confirm whether to ship knowledge graph as a "tab" or a "view".
- [ ] Decide on the concept extraction cadence (eager / lazy /
      manual).
- [ ] Decide how aggressive concept normalization should be (false
      positives can collapse distinct ideas).

---

Continue to [Phase R — Unlimited Edition](phase-r-unlimited.md).
