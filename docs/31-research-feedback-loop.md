# 31 — Research Feedback Loop

The Research Feedback Loop is the adaptive layer that biases future
Discovery searches based on user actions on past results. It is **purely
text-based bias** — no embeddings, no vector store, no learned ranker —
just last-N feedback log entries embedded in the next Step 1 prompt.

> Implemented in Phase L alongside Discovery
> (`implementation-plan/phase-l-discovery-module.md`).
> Adopted from ThesisCraft's feedback log with project scoping and a few
> persistence upgrades.

---

## Data model

### `research_feedback` IDB store (new in Phase L)

```ts
interface ResearchFeedback {
  id: string;                  // "fb_<ts>"
  projectId: string | null;    // null = global / no-project search
  action: 'favorite' | 'dismiss' | 'rate' | 'add_to_library' | 'cite';
  sourceTitle: string;         // duplicated from the result for log self-containment
  sourceAuthors?: string;
  sourceUrl?: string;
  concepts: string[];          // from analysis
  rating?: number;             // 1-5, only when action === 'rate'
  timestamp: string;           // ISO
}
```

Indexed by `id`, `projectId`, `timestamp`.

ThesisCraft used `localStorage` (single global array, no project field).
Headway adds `projectId` so feedback is project-scoped, and uses IDB so
the log can grow past localStorage's 5–10 MB limit.

### Caps

- No hard cap on count (IDB is generous), but Phase L reads only the
  **most recent 20** entries for the active project when prompting.
- A background "Compact" routine in Phase O+ (Sync Plus) prunes entries
  older than 6 months and entries from archived projects.

---

## When entries are written

Every interaction with a Discovery result writes a `ResearchFeedback`:

| Discovery action | Feedback action |
|---|---|
| Heart (favorite ON) | `favorite` |
| Heart (favorite OFF) | *no log* (TC matches; only the toggle-on is meaningful) |
| Star rating set | `rate` (with rating value) |
| Dismiss | `dismiss` |
| Add to library | `add_to_library` |
| Cite from Discovery card | `cite` (Phase Q) |

Not logged:
- Pure browsing (scrolling through results)
- Opening external URL
- Re-favoriting after un-favoriting (only the first ON is logged)

---

## How feedback shapes future searches

Step 1 of the Discovery pipeline is the Gemini query optimizer. Its
prompt embeds the last 20 entries verbatim:

```
You are an academic research assistant helping refine search queries.

Project: {project.title}
Project kind: {project.kind}
Project description: {project.description ?? ''}
Existing search keywords: {project.keywords.join(', ')}

User's recent preferences (last 20 actions):
- favorite: "Job crafting and engagement among Slovenian sales reps"
  (concepts: engagement, autonomy, sales)
- rate: "Self-determination in sales contexts" (concepts: SDT, intrinsic,
  rating: 5)
- add_to_library: "Job crafting among health care workers" (concepts: ...)
- dismiss: "Generic motivation theory" (concepts: motivation, generic)
- dismiss: "Burnout in HR managers" (concepts: burnout, HR)
... (truncated to most recent 20)

Generate exactly 3 search queries that:
- Build on topics the user has favourited or rated highly
- Avoid topics the user has dismissed
- Each cover a distinct angle (e.g. theory, methodology, application)
- Are specific, academic, and likely to return real peer-reviewed work

Return JSON: {"queries": [q1, q2, q3]}
```

This is the **entire** adaptive layer — Gemini chooses what to do with the
natural-language history. There's no embedding similarity, no ranker, no
learned weights. Cheap, transparent, debug-able.

---

## Inspecting the feedback log

A new "Research feedback" panel in Project Settings shows the active
project's log:

```
Feedback log (Project: My MA Thesis)                    [Export] [Clear]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2026-05-03 14:32  favorite  "Job crafting and engagement…"
                  concepts: engagement, autonomy, sales
2026-05-03 14:31  dismiss   "Generic motivation theory"
                  concepts: motivation
…
```

Filters: by action, by date range, by concept. Clear is per-project (not
global).

A power-user "explain this query" button shows what feedback entries the
optimizer was given for the last search batch.

---

## Why no embeddings (yet)

Embeddings would let us:
- Surface "you favorited 4 articles about autonomy in sales — here are 3
  more matching that semantic cluster"
- Auto-cluster the feedback log
- Detect when the user is exploring a new sub-topic vs deepening an
  existing one

But: free embedding APIs are limited (Voyage, Cohere have generous tiers
but rate-limited), and Gemini text-embedding adds another paid call per
result. The text-only approach is "good enough" for this use case and
keeps the architecture simple.

Phase X (Research Mode Suite) considers adding embeddings as an *optional*
upgrade, gated on a settings toggle.

---

## Project-scoped vs global

In **no-project mode**, feedback is written with `projectId: null` and
read back the same way. Switching to project-mode does **not** migrate
old global feedback into a project — that would be lossy and presumes
intent.

A "Adopt global feedback into this project" action exists in Project
Settings for users who want to apply their pre-project history.

---

## Drive sync

`research_feedback` is added to the sync envelope. Last-write-wins per
`id`. Per-project filtering happens at read time, so syncing the whole
log across devices works without filtering on the wire.

---

## Notable behaviour

- **Feedback persists across the project lifecycle** — even after a section
  is finalized, the feedback log keeps shaping new searches.
- **Dismissed sources are still feedback** — a user who dismisses 50
  irrelevant results is teaching the optimizer what NOT to search for.
- **No "negative learning" cap** — a project with 50 dismisses and 0
  favorites can over-bias against discovery. Phase X adds a "reset
  feedback" button and a "preview my biases" view.

---

## Continue reading

- Discovery uses this loop: [`27-discovery-module.md`](27-discovery-module.md)
- Project model: [`26-projects-and-research-workspaces.md`](26-projects-and-research-workspaces.md)
- AI provider for Step 1 query gen: [`16-ai-providers.md`](16-ai-providers.md)
