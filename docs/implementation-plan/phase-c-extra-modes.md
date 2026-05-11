# Phase C — Mind Map, Socratic Dialogue, and Chat

> **Tagline:** Turn the chapter into a conversation partner.

## Goal

Add three additional reading modes that go beyond passive consumption:
visual mind maps, multi-turn Socratic dialogue, and direct chat
grounded in the chapter content.

## Why this phase / rationale

Phase B's modes are one-shot generations. Real comprehension comes
from interaction:

- A **mind map** restructures information visually so structural
  weaknesses become obvious.
- **Socratic dialogue** forces the user to articulate ideas instead of
  passively consuming a summary.
- **Chat** is the catch-all for "wait, what does this mean?" lookups.

These three modes share the same backend infrastructure (cache + AI
call + render) introduced in Phase B, with the addition of a
**conversation manager** that all chat-style modes reuse.

## Prerequisites

- Phase B complete (`callAI` exists, cache pattern works, sanitizer
  ships).

## Deliverables

- 🧠 Mind Map mode with SVG renderer.
- 🤔 Socratic mode with persisted conversation history.
- 💬 Chat ("Ask") mode scoped to the chapter.
- 💬 Book-level Ask Book modal (full-screen).
- Reusable conversation component.
- Chat message rendering with inline markdown.

## Task breakdown

### C1 — Mind Map mode

- `generateMindmap(content, title, apiKey)` → JSON tree:
  ```json
  {
    "center": "Main Topic",
    "branches": [
      { "title": "Theme 1", "color": "#FF6B6B",
        "subbranches": [
          { "title": "Sub 1.1", "items": ["detail", "detail"] }
        ] }
    ]
  }
  ```
- Hand-rolled SVG renderer:
  - Center node at viewBox center.
  - Branches radiate at even angles.
  - Sub-branches stack vertically off each branch.
  - Color-coded connecting lines.
  - 5 fixed colors cycling: `#FF6B6B #4ECDC4 #45B7D1 #FFA07A #98D8C8`.
- Responsive viewBox so it shrinks to phone width.
- Regenerate button.
- Cache as `mindmap_<chapterId>`.

### C2 — Conversation manager (shared component)

A reusable component for any chat-style mode:

- State: `messages: Array<{role, content, ts}>`.
- Renders bubble layout: user right-aligned, AI left, system centered.
- Auto-scroll to bottom on new message.
- Enter sends, Shift+Enter newlines.
- Loading dots animation while waiting for AI.
- Error bubble on failure with retry button.
- `formatChatMessage(text)` for inline markdown only (bold, italic,
  inline code, no block elements).

### C3 — Socratic mode

- Init prompt: "You are a Socratic tutor. Never give the answer
  directly. Probe with questions. Build on the student's previous
  answers. After 5 exchanges, offer a synthesis only if the student
  is stuck."
- Maintain `socraticHistory_<chapterId>` row in `generated` store
  with the message array.
- Resume: re-open the mode, history is restored.
- "Reset conversation" button wipes the row.

### C4 — Chapter Ask mode

- Same conversation component, different system prompt:
  "Answer only from the chapter content provided. If the answer isn't
  in the chapter, say so explicitly."
- Inject `chapter.content` as context in every turn (the AI may
  benefit from seeing the chapter every time, since it has no real
  memory beyond the conversation).
- Conversation **not** persisted — each open starts fresh (this
  mirrors a search-style interaction).

### C5 — Book Ask modal

- Triggered by an "Ask the Book" button on the book detail.
- Full-screen overlay with the conversation component.
- Inject `chapters[].content` joined and truncated to fit the model
  window.
- Same not-persisted behavior.
- Optional caching of the most recent N messages keyed by `bookId`
  for "resume the chat".

### C6 — Streaming responses (optional but worth it)

If a provider supports SSE / streaming (Phase H's Merlin), wire the
conversation component to update the AI bubble token-by-token. This
phase only needs the plumbing — Phase H will populate it.

For Gemini today, simulate streaming by chunking the final response in
50-char slices with a 20 ms delay so the UX feels alive.

### C7 — Renderable AI safety

- All AI output goes through `sanitizeHtml`.
- Embed `chapter.title` in prompts as a quoted string but never echo
  raw user input back into the prompt context unsanitized.

### C8 — Mode tab additions

Add the new tabs to the chapter view:
- 💬 Ask
- 🤔 Socratic
- 🧠 Mind Map

Order: Read, Listen (placeholder until Phase E), Ask, Summary, Quiz,
Flashcards, Teach, Socratic, Mind Map, Feed (placeholder until Phase
D), Video (placeholder until Phase K).

## Acceptance criteria

- [ ] Mind map renders as SVG and adapts to phone width without
      clipping.
- [ ] Mind map regenerate button creates a new map.
- [ ] Socratic conversation persists across page reloads.
- [ ] Reset Socratic clears the history.
- [ ] Chapter Ask answers questions from the chapter and refuses to
      answer questions outside the chapter.
- [ ] Book Ask handles a 50k-word book without timing out (chunk
      strategy in place).
- [ ] No XSS through AI output.
- [ ] All three modes work offline against cached generations
      (mindmap) or fail gracefully (chat / socratic, which need
      live AI).

## Effort estimate

- **T-shirt:** S
- **Person-weeks:** 1–2
- **Critical path:** SVG layout for mind map.

## Risks & unknowns

- **SVG layout** is the trickiest part. Math for radial layouts
  requires care; expect a day of pixel-pushing.
- **Long book context** in the Book Ask modal can blow past the
  Gemini context window. Truncate strategically: prefer chapter
  titles + summaries over raw text when the book exceeds the limit.
- **Socratic prompt fidelity** — models drift toward giving answers.
  Reinforce the system prompt every 3 turns.

## Out of scope

- Streaming UI for Merlin (Phase H delivers the SSE; this phase only
  keeps the plumbing ready).
- Multi-book chat (Phase L).
- DocAnalyzer's upload-then-chat flow (Phase H).

## Decision points before Phase D

- [ ] Confirm the conversation component's API. Phase L's batch chat
      and Phase H's per-provider chat will reuse it.
- [ ] Confirm whether to persist Chapter Ask history. Default no, but
      some users will want it.

---

Continue to [Phase D — Feed System](phase-d-feed-system.md).
