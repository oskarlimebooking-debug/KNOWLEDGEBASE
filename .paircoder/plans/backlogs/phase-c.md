# Sprint C: Mind Map, Socratic Dialogue, and Chat

> One task per T-item in `docs/implementation-plan/phase-c-extra-modes.md`.
> Three more reading modes. Adds the reusable conversation component every later chat-style mode reuses.

### Phase 1: Mind map + shared chat plumbing

### TC.1 -- Mind Map mode (SVG renderer) | Cx: 13 | P0

**Description:** `generateMindmap(content, title, apiKey)` returns a JSON tree (`center`, `branches[]` with `subbranches[]` and `items[]`). Hand-rolled SVG renderer: center node, branches radiating at even angles, sub-branches stacking vertically, color-coded connecting lines (5 fixed colors cycling). Responsive viewBox; shrinks to phone width. Regenerate button. Cache as `mindmap_<chapterId>`.

**AC:**
- [ ] Mind map renders for a fixture chapter and adapts to 320px viewport without clipping
- [ ] Regenerate button creates a new map (deletes cache, refetches)
- [ ] Color cycling stable: same tree shape always gets same colors
- [ ] SVG is keyboard-focusable for accessibility
- [ ] No layout overflow on long branch titles

**Depends on:** TB.4, TB.9

### TC.2 -- Conversation component (shared) | Cx: 8 | P0

**Description:** Reusable component: state `messages: Array<{role, content, ts}>`, bubble layout (user right, AI left, system center), auto-scroll to bottom on new message, Enter sends, Shift+Enter newlines, loading dots while waiting, error bubble with retry. `formatChatMessage(text)` for inline markdown only (no block elements).

**AC:**
- [ ] Conversation component published as a standalone module
- [ ] Auto-scroll respects user-pinned-to-bottom (if user scrolls up, don't yank)
- [ ] Error bubble with Retry hits the same prompt
- [ ] Vitest covers message append, scroll behavior, error state
- [ ] No XSS in `formatChatMessage`

**Depends on:** TB.9

### Phase 2: Socratic + chapter chat + book chat

### TC.3 -- Socratic mode | Cx: 5 | P1

**Description:** System prompt: never give answers directly; probe with questions; build on previous answers; after 5 exchanges offer synthesis if user is stuck. Maintain `socraticHistory_<chapterId>` row in `generated`. Resume restores history. Reset button wipes the row.

**AC:**
- [ ] History persists across page reloads
- [ ] Reset button removes the IDB row and clears the UI
- [ ] AI consistently asks questions on 3+ test exchanges (manual)
- [ ] System prompt reinforcement at turn 3 prevents drift

**Depends on:** TC.2, TB.4

### TC.4 -- Chapter Ask mode | Cx: 5 | P1

**Description:** Same conversation component. System prompt: "Answer only from the chapter content provided. If not in chapter, say so." Inject `chapter.content` as context every turn. Conversation NOT persisted (search-style interaction).

**AC:**
- [ ] Out-of-chapter question is refused with explicit "not in this chapter"
- [ ] In-chapter question is answered correctly (3 manual fixtures)
- [ ] Conversation resets on view switch
- [ ] No XSS via AI response

**Depends on:** TC.2

### TC.5 -- Book Ask modal | Cx: 8 | P1

**Description:** "Ask the Book" button on book detail. Full-screen overlay with the conversation component. Inject `chapters[].content` joined and truncated to fit the model window (prefer chapter titles + summaries over raw text on overflow). Not persisted. Optional N-message cache keyed by `bookId` for "resume the chat".

**AC:**
- [ ] Handles a 50k-word book without timing out
- [ ] Truncation strategy proven on fixture (no silent truncation past summary)
- [ ] Resume cache (if implemented) survives reload
- [ ] Modal closes on Escape

**Depends on:** TC.4

### Phase 3: Streaming + safety + tabs

### TC.6 -- Streaming-response plumbing | Cx: 5 | P2

**Description:** If a provider supports SSE (Phase K's Merlin), wire conversation component to update AI bubble token-by-token. For Gemini today: simulate streaming by chunking final response in 50-char slices with 20ms delay so UX feels alive.

**AC:**
- [ ] Conversation component accepts a token callback
- [ ] Gemini path simulates streaming visibly
- [ ] Backpressure: rapid token deliveries don't cause jank
- [ ] Phase K's real SSE will reuse this surface (verified by interface review)

**Depends on:** TC.2

### TC.7 -- Renderable AI safety (sanitization) | Cx: 3 | P0

**Description:** All AI output through `sanitizeHtml`. Embed `chapter.title` as quoted string; never echo raw user input back into the prompt unsanitized.

**AC:**
- [ ] XSS fixture suite green
- [ ] Prompt injection fixture (user input containing `</context>...`) doesn't escape context
- [ ] Markdown rendering for AI responses goes through the Phase B sanitizer
- [ ] Vitest covers 5+ injection vectors

**Depends on:** TB.9

### TC.8 -- Mode tab additions | Cx: 3 | P1

**Description:** Add 💬 Ask, 🤔 Socratic, 🧠 Mind Map tabs in chapter view. Final order: Read, Listen (placeholder until E), Ask, Summary, Quiz, Flashcards, Teach, Socratic, Mind Map, Feed (placeholder until D), Video (placeholder until R).

**AC:**
- [ ] Tab order matches spec
- [ ] Placeholders show "Coming in Phase X" empty state
- [ ] Tab switching preserves per-mode state
- [ ] Mobile tab bar scrolls horizontally without clipping content

**Depends on:** TC.1, TC.3, TC.4

---

## Sprint enforcement gates (must pass before Sprint D begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — coverage ≥ 86%
- [ ] **G-Security** — sanitizer & prompt injection suites green
- [ ] **G-Manual** — Conversation component API locked (Phase K and Phase L reuse it)
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint D:**

- [ ] Confirm conversation component API (batch chat / per-provider chat will reuse)
- [ ] Decide whether to persist Chapter Ask history (default no)
