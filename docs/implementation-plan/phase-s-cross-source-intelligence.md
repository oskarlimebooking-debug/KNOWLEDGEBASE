# Phase L — Cross-Book Intelligence

> **Tagline:** Talk to your whole library at once.

## Goal

Add features that span multiple books at once: book-level feed,
multi-book feed (cross-book synthesis), cross-book feed (one chapter
through the lens of another book), book-level mind map, and a batch
chat that lets the user ask questions of multiple books simultaneously.

## Why this phase / rationale

A library that's only useful one-book-at-a-time is half-utilizing its
data. The most interesting AI use cases are emergent: "where do
Sapiens and Thinking Fast and Slow agree?" / "what would Daniel
Kahneman say about this chapter from Antifragile?" These are
**cross-corpus** questions and need cross-corpus features.

This phase introduces multi-select UI for the library and the
"context bundle" pattern (multiple chapters / books packaged as one
context for the AI).

## Prerequisites

- Phases A–H.
- Phase D: feed primitives.
- Phase C: chat / conversation component.
- Phase F: sync (so cross-book features survive devices).

## Deliverables

- 📚 Book-level mind map (cross-chapter).
- 📱 Book-level feed (random insights across the whole book).
- 🔀 Multi-book feed (cross-book synthesis).
- 🪡 Cross-book feed (one chapter into another book's context).
- 💬 Multi-book Ask (batch chat).
- Library multi-select mode.
- Batch tag for selected books.
- "Generate All" buttons that fan-out across selected books.

## Task breakdown

### L1 — Library multi-select

Toggle button on library: "Select Books".

When active:
- Each book card shows a checkbox.
- Tap toggles selection.
- Bottom action bar: "Tag", "Generate Feed", "Chat", "Cancel".

State:
```js
let selectedBookIds = new Set();
let bookSelectionMode = false;
```

### L2 — Batch tagging

`batchTagSelectedBooks()`:
- Modal with tag input.
- Apply the tag to all selected books.
- Update IDB rows + refresh library.

### L3 — Book mind map

`openBookMindmap()` (`generateBookMindmap`):
- Concatenate chapters with title labels.
- Truncate to fit the model.
- Use the same `mindmap` prompt but at book scope.
- Cache: `book_mindmap_<bookId>`.

Renderer same as Phase C, just a larger SVG.

### L4 — Book feed

`openBookFeed()`:
- Use the `bookFeed` prompt (similar to `feed` but with a
  "RANDOMLY SELECT 20 from across the book" instruction).
- Cache: `book_feed_<bookId>`.
- Renderer reuses the Phase D feed renderer with one extension: each
  post may include `sourceChapter` showing which chapter the insight
  came from.

### L5 — Multi-book feed

`generateMultiBookFeedAction()`:
- Prompt: `multiBookFeed` with explicit cross-book instructions
  (CONNECT, CONTRADICT, SYNTHESIZE, COMPARE).
- Each post includes `sourceBooks: [...]`.
- Cache key: deterministic from sorted book IDs:
  `multi_book_feed_<sortedJoinedIds>`.

### L6 — Cross-book feed

A unique mode: read one chapter through the lens of another book.

`openCrossBookFeed()`:
- User selects a source chapter (from any book).
- User selects a target book.
- AI generates 20 posts that connect the chapter's concepts to the
  target book's content.
- Cache: `cross_<sourceCh>_to_<targetBook>`.

`generateCrossBookFeedContent(chapterTitle, chapterContent,
sourceBookTitle, targetBookTitle, targetBookContent, apiKey)`.

### L7 — Multi-book Ask (batch chat)

`openBatchChat()`:
- Library multi-select → "Chat".
- Modal with the conversation component (Phase C).
- Selected books shown as "tags" at the top; tap to remove.
- "Add Book" lets the user expand the context.
- Send a question → context = concatenation of selected book contents
  (truncated to fit the model window).
- AI dispatches via `callAI`.

DocAnalyzer special case: each book becomes a separate uploaded
document; the question is asked against each, then the answers are
synthesized in a final call.

### L8 — Generation bookkeeping

Each generation goes into the `generated` store with its dedicated
ID pattern. Cache hits feel instant; misses fall through to the AI.

### L9 — Sync extension

The new cache rows sync via Drive automatically (they're in the
`generated` store, which is already synced).

### L10 — Failure handling

Multi-book ops are expensive. Surface:
- Estimated token cost before generation.
- Time elapsed indicator while waiting.
- Cancel button (best-effort — AI calls may continue).

### L11 — Library "Generate All" power-ops

Buttons on book detail (and bulk on library):
- "Generate Summary for all chapters"
- "Generate Quiz for all chapters"
- "Generate Feed for all chapters"
- "Generate Audio for all chapters" (uses Phase E's batch audio modal)
- "Generate Video for selected chapters" (uses Phase K's book video
  modal)

Each opens a progress modal with per-item status.

### L12 — Empty / sparse states

Cross-book features need at least 2 books. Show empty states with
helpful CTAs ("Add another book to enable cross-book features").

## Acceptance criteria

- [ ] User can multi-select books and apply a tag.
- [ ] Book feed generates with `sourceChapter` annotations.
- [ ] Multi-book feed generates with `sourceBooks` annotations.
- [ ] Cross-book feed (chapter X → book Y) produces useful posts.
- [ ] Multi-book chat answers a question that requires synthesizing
      across books.
- [ ] DocAnalyzer flow works for batch chat.
- [ ] All cross-book caches sync via Drive correctly.
- [ ] Cancel during a long generation doesn't leave the UI in a bad
      state.

## Effort estimate

- **T-shirt:** M
- **Person-weeks:** 2–3
- **Critical path:** prompt iteration for cross-book features (the
  model needs strong guidance to actually find connections).

## Risks & unknowns

- **Context window** — even with truncation, multi-book contexts
  exceed many models' limits. Truncation strategy must prefer
  summaries over raw text.
- **Cost** — multi-book operations are 10× a single-chapter call.
  Surface cost upfront.
- **DocAnalyzer flow** for batch chat is multi-step and slow. Treat
  as best-effort with a clear progress UI.
- **Cross-book quality** depends heavily on which books are chosen.
  Pair non-overlapping topics produces nonsense; document this.

## Out of scope

- Library-wide search (Phase N).
- Knowledge graph (Phase Q).
- Auto-suggested book pairings based on detected concept overlap
  (Phase Q).
- Native (non-multiselect) "Ask my whole library" command palette
  (Phase R).

## Decision points before Phase M

- [ ] Confirm cache key naming for multi-book features. They're a
      mouthful but stable IDs are essential.
- [ ] Decide whether to limit multi-book chat to N=4 books to bound
      cost, or allow unbounded.
- [ ] Decide whether to expose chapter-level cross-references as a
      first-class feature (currently chapter-to-book only).

---

This is the last phase that fits comfortably in a single-file
architecture. Phase M is the architectural rebuild.

Continue to [Phase M — Architectural Modernization](phase-m-architectural-rebuild.md).
