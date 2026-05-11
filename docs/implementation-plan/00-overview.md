# Implementation Plan — Phased Rebuild Roadmap

This folder is the **build plan** for the merged Headway app
(Headway × ThesisCraft), ordered from "essential MVP" to "unlimited
budget nice-to-haves". Each phase is self-contained, has explicit
prerequisites, and can be shipped on its own.

**Plan structure (post-merger)**: 25 phases (A–Y). Phase G is the
foundational TypeScript + Vite + modular rebuild — it has been moved
forward from its pre-merger position (was M) so all subsequent phases
build on the modern stack. Phases H, I, L, O, P, Q, X are **new**
phases introduced by the merger to deliver the RESEARCH and WRITE
pillars.

---

## Phase index

| Phase | Title | Tagline | T-shirt | Person-weeks |
|---|---|---|---|---|
| [A](phase-a-foundation.md) | Foundation | Static reader, IDB, PWA shell | M | 2–3 |
| [B](phase-b-ai-core.md) | AI Core & Basic Learning | Gemini provider, summary, flashcards, classic quiz, teach-back | M | 3–4 |
| [C](phase-c-extra-modes.md) | Mind Map, Socratic, Chat | The remaining "talk to your chapter" modes | S | 1–2 |
| [D](phase-d-feed-system.md) | Feed System | 12 personalities, 20-post feed, image gen, deep-dive writeups | L | 4–6 |
| [E](phase-e-tts-and-player.md) | TTS & Persistent Player | Browser TTS, Lazybird, Google TTS, lockscreen integration | L | 4–5 |
| [F](phase-f-cloud-sync.md) | Cloud Sync | Drive appData, OAuth, merge, memory-safe streaming | M | 2–3 |
| [G](phase-g-architectural-rebuild.md) | **Architectural Rebuild** | TypeScript + Vite + modular + workers + OPFS — foundation | XL | 8–12 |
| [H](phase-h-multi-project-workspaces.md) | **Multi-Project Workspaces** | Project entity, switcher, JSON import, no-project mode | M | 3–4 |
| [I](phase-i-source-generalization.md) | **Source Generalization** | Book → Source (book/article/url/note); IDB migration | M | 2–3 |
| [J](phase-j-advanced-quizzes.md) | Advanced Quizzes & Learning Hub | Speed, Fill-Blanks, Debate, Connections, Who-Am-I, cross-chapter games | L | 4–5 |
| [K](phase-k-multi-provider-ai.md) | Multi-Provider AI + Perplexity | Merlin, Junia, DocAnalyzer, **Perplexity Sonar**, Vercel proxies | M | 2–3 |
| [L](phase-l-discovery-module.md) | **Discovery Module** | Perplexity 3-step pipeline, sub-tabs, feedback loop, 24h cache | L | 3–4 |
| [M](phase-m-advanced-import.md) | Advanced Import & OCR + URL/DOI | AI-OCR, page review, batch queue, **article URL ingestion** | L | 4–6 |
| [N](phase-n-pdf-viewer.md) | PDF Viewer | Scroll/slide, rotation, zoom, highlighter, pen, save-to-PDF | M | 2–3 |
| [O](phase-o-writing-hub.md) | **Writing Hub** | Outline editor, streaming AI drafts (NDJSON), section status | L | 4–5 |
| [P](phase-p-writing-exercises.md) | **Writing Exercises** | 6 exercise types, persistence, AI feedback | M | 3–4 |
| [Q](phase-q-citations-and-sources.md) | **Citations & Source Library** | Citation entity, BibTeX export, Zotero import, in-text citation picker | M | 3–4 |
| [R](phase-r-video-and-images.md) | Video & Image Generation | Vadoo viral videos, Bonkers via Merlin, AI cover regen | M | 2–3 |
| [S](phase-s-cross-source-intelligence.md) | Cross-Source Intelligence | Source feed, multi-source feed, cross-source feed, batch chat | M | 2–3 |
| [T](phase-t-quality-of-life.md) | Quality of Life | Search, in-text annotations, spaced repetition, themes | L | 4–6 |
| [U](phase-u-sync-plus.md) | Sync Plus | Encrypted, multi-cloud, CRDT (Yjs), real-time, per-store delta | L | 4–6 |
| [V](phase-v-audio-plus.md) | Audio Plus | Word-by-word highlighting (Whisper), local TTS (Kokoro/Piper), SSML | L | 4–6 |
| [W](phase-w-knowledge-plus.md) | Knowledge Plus + Research Graph | Concept extraction, knowledge graph, **research graph**, reading paths | L | 4–6 |
| [X](phase-x-research-mode-suite.md) | **Research Mode Suite** | Hypothesis tracker, claim verifier, evidence map, supervisor share | L | 4–5 |
| [Y](phase-y-unlimited.md) | Unlimited Edition | Native apps, extensions, i18n, accessibility, multi-user, premium AI | XXL | 12–100+ |

**Totals**: 25 phases, ~88-130 person-weeks for everything (3-person team
working part-time → 9-12 months for the entire roadmap).

**Bold** = NEW phases or significantly EXTENDED phases introduced by the
Headway × ThesisCraft merger.

---

## Phasing philosophy

1. **Ship something usable ASAP.** Phase A delivers a working PWA reader
   without any AI dependency.
2. **Pull hard problems into isolated phases.** Phase G (rebuild) is
   isolated; Phase L (Discovery) is isolated; Phase U (CRDT sync) is
   isolated.
3. **Phase G is foundational.** Until it ships, all merger-specific phases
   (H–Y) are blocked. Pre-Phase-G features run in the legacy single-file
   architecture.
4. **Save "wow" features for after stability.** Phase Y is the wishlist.
5. **Always be syncing.** Phase F is early so multi-device works from
   day one.

---

## Critical paths

Three suggested critical paths depending on what the team prioritizes:

### Path 1 — Reading-first (pre-merger feel)

```
A → B → F → E → D → G → ... (then merger features in order)
```

Ships a polished READ pillar through Phases A–F and E–D, then commits
to the rebuild and adds RESEARCH/WRITE pillars.

### Path 2 — Writing-first (thesis sprint)

```
A → B → F → G → H → I → K → O → P → Q → ... (then everything else)
```

Sprint to a usable thesis-writing tool. Skips quiz polish (J), OCR
ingestion (M), PDF viewer (N), audio (E, V) until later. Risky — the
WRITE pillar needs library content to cite, so M and (some) E should
come somewhere.

### Path 3 — Research-first (literature review)

```
A → B → F → G → I → K → L → M → ... (then everything else)
```

Sprint to a usable Discovery + Source Library tool. Useful for someone
collecting and organizing sources before writing.

---

## Trajectory: From MVP to Unlimited

**MVP (Phase A alone)**: Offline reader + IDB + PWA. Zero AI.

**Core READ (Phases A–F + E)**: Library + 11 reading modes + sync.
Single-user-complete app.

**Foundation (Phase G)**: Modular rebuild. Pre-Phase-G code frozen on
`legacy-singlefile` branch.

**RESEARCH + WRITE pillars (Phases H–Q)**: Multi-project workspaces,
Discovery, Writing Hub, Citations.

**Polish (Phases R–W)**: Video, cross-source intelligence, QoL, sync
plus, audio plus, knowledge graph.

**Power (Phase X)**: Research Mode Suite (hypothesis tracking, evidence
maps, claim verification).

**Wishlist (Phase Y)**: 23+ sub-features. Pick and choose.

---

## Format per phase document

Each phase document follows the same 10-section template:

1. **Goal** — one-sentence outcome
2. **Why this phase / rationale** — problem solved
3. **Prerequisites** — prior phases required
4. **Deliverables** — concrete user features
5. **Task breakdown** — engineering work labeled T1, T2, …
6. **Acceptance criteria** — measurable done
7. **Effort estimate** — T-shirt + person-weeks
8. **Risks & unknowns** — gotchas
9. **Out of scope** — NOT in this phase
10. **Decision points** — what to validate before next phase

---

## Phase letter mapping (pre-merger → post-merger)

For anyone reading old commit messages or PRs:

| Pre-merger (A-R) | Post-merger (A-Y) |
|---|---|
| A | A (unchanged) |
| B | B (unchanged) |
| C | C (unchanged) |
| D | D (extended: 12 personalities) |
| E | E (unchanged) |
| F | F (unchanged) |
| G (Advanced Quizzes) | **J** |
| H (Multi-Provider AI) | **K** (extended: Perplexity) |
| I (Advanced Import) | **M** (extended: URL/DOI) |
| J (PDF Viewer) | **N** |
| K (Video & Images) | **R** |
| L (Cross-Book) | **S** (renamed: Cross-Source) |
| M (Architectural Rebuild) | **G** (moved forward — now foundational) |
| N (Quality of Life) | **T** |
| O (Sync Plus) | **U** |
| P (Audio Plus) | **V** |
| Q (Knowledge Plus) | **W** (extended: research graph) |
| R (Unlimited) | **Y** |
| — | **H** (NEW: Multi-Project Workspaces) |
| — | **I** (NEW: Source Generalization) |
| — | **L** (NEW: Discovery Module) |
| — | **O** (NEW: Writing Hub) |
| — | **P** (NEW: Writing Exercises) |
| — | **Q** (NEW: Citations) |
| — | **X** (NEW: Research Mode Suite) |

---

## Continue reading

Start with [Phase A](phase-a-foundation.md) and read forward in order, or
jump directly to a phase of interest. Each phase doc references its
prerequisites at the top.
