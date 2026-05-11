# Sprint X: Research Mode Suite — Hypothesis tracker, claim verifier, evidence map, supervisor share

> One task per T-item in `docs/implementation-plan/phase-x-research-mode-suite.md` (T1–T13 in source doc).
> Advanced research tooling on top of merged app: hypothesis tracker, claim verifier, evidence map, supervisor share link, embeddings-based semantic search.

### Phase 1: Hypothesis tracker + claim verifier

### TX.1 -- Hypothesis tracker view | Cx: 8 | P0

**Description:** Count citations per hypothesis (read from sprint Q). Display in dashboard list.

**AC:**
- [ ] Lists all hypotheses for active project
- [ ] Citation count + supports/contradicts breakdown
- [ ] Click → list of citations
- [ ] LiveQuery for reactivity

**Depends on:** TQ.1, TH.1

### TX.2 -- Claim verifier UI | Cx: 8 | P1

**Description:** Modal with claim textarea + "Find evidence" button. Shows supporting + contradicting sources from library.

**AC:**
- [ ] Search returns ranked results
- [ ] Per-result: support/contradict label
- [ ] Click navigates to chapter

**Depends on:** TX.3

### TX.3 -- Claim verifier prompt | Cx: 5 | P1

**Description:** "You are a research assistant. Given this claim and excerpts from these sources, classify each as supports/contradicts/unrelated and give a short reason."

**AC:**
- [ ] Prompt deterministic
- [ ] Cached per claim
- [ ] Returns structured JSON

**Depends on:** TB.1

### Phase 2: Evidence map + daily digest

### TX.4 -- Evidence map visualization | Cx: 8 | P1

**Description:** Reuse sprint W force-directed graph. Hypothesis nodes connected to supporting/contradicting sources via citations.

**AC:**
- [ ] All 3 entity types render
- [ ] Edges color-coded
- [ ] Export as image

**Depends on:** TW.13

### TX.5 -- Daily digest scheduler | Cx: 5 | P2

**Description:** Cron-like via Vercel cron or per-tab on open. Runs Discovery + ranks new results by relevance to active project.

**AC:**
- [ ] Runs once per 24h
- [ ] Surfaces top 5 results
- [ ] User can disable

**Depends on:** TL.3

### TX.6 -- Daily digest UI | Cx: 3 | P2

**Description:** Surface top 5 on project dashboard.

**AC:**
- [ ] Renders on dashboard
- [ ] Dismiss / save / open per result
- [ ] Empty state when no new results

**Depends on:** TX.5

### Phase 3: Semantic search via embeddings

### TX.7 -- Embeddings provider plugin | Cx: 8 | P0

**Description:** `EmbeddingsPlugin` interface. Implementations: Gemini embeddings, OpenAI ada (optional).

**AC:**
- [ ] Interface published
- [ ] At least 1 implementation
- [ ] Embedding rows cached in IDB

**Depends on:** TG.6

### TX.8 -- Embedding indexer worker | Cx: 13 | P0

**Description:** When embeddings enabled, embeds new sources + chapters on import. Incremental updates.

**AC:**
- [ ] All sources have embeddings after first run
- [ ] Incremental: only new content embedded
- [ ] Worker doesn't block UI

**Depends on:** TX.7, TG.7

### TX.9 -- Semantic search route in Discovery | Cx: 8 | P1

**Description:** When embeddings enabled, Discovery's semantic search uses cosine similarity instead of (or alongside) Perplexity.

**AC:**
- [ ] Toggle in Settings: semantic / keyword / both
- [ ] Latency < 100ms for 1k-source library
- [ ] Results merged sensibly with Perplexity

**Depends on:** TL.3, TX.8

### Phase 4: Sharing + dashboard + sync + tests

### TX.10 -- Supervisor share link | Cx: 8 | P2

**Description:** Generate hash; write tiny read-only snapshot to a sharable URL (e.g., Vercel KV or static JSON).

**AC:**
- [ ] Link generated with expiry
- [ ] Read-only view renders publicly
- [ ] Revoke works
- [ ] Privacy: only shared fields visible

**Depends on:** TQ.13

### TX.11 -- Research dashboard /research/:projectId | Cx: 8 | P0

**Description:** Consolidates: hypotheses + citations + Discovery digest + evidence map link + supervisor share button.

**AC:**
- [ ] All 5 widgets render
- [ ] Mobile-friendly
- [ ] LiveQuery for reactivity

**Depends on:** TX.1, TX.4, TX.6, TX.10

### TX.12 -- Sync extensions (embedding cache, opt-in) | Cx: 5 | P1

**Description:** Embedding cache is large; opt-in to sync.

**AC:**
- [ ] Sync toggle in Settings
- [ ] Default off (size warning shown)
- [ ] Backward compat

**Depends on:** TF.7, TX.8

### TX.13 -- Tests | Cx: 5 | P1

**Description:** Vitest on hypothesis strength calc, claim verifier prompt, semantic search vector math. e2e: hypothesis + 5 citations → tracker shows correct counts.

**AC:**
- [ ] Coverage ≥ 86%
- [ ] e2e green
- [ ] Vector math unit tests ≥ 95%

**Depends on:** TX.11

---

## Sprint enforcement gates (must pass before Sprint Y begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — hypothesis strength calc ≥ 95%; semantic search ≥ 90%
- [ ] **G-Security** — supervisor share never exposes private fields
- [ ] **G-Manual** — Real fixture: 1 project, 3 hypotheses, 20 citations → dashboard makes sense
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint Y:**

- [ ] Embeddings: bundled vs cloud (privacy tradeoff)
- [ ] Supervisor share expiry default (7 days?)
