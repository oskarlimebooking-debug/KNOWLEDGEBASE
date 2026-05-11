# Phase N — Quality of Life

> **Tagline:** The improvements you didn't know you wanted until you had them.

## Goal

Add the small-but-significant features that turn a usable reader into
a daily habit: full-text search, in-text annotations, spaced
repetition, theming, position memory, word definitions, smart
library organization, and additional import sources.

## Why this phase / rationale

Phases A–L deliver an impressive feature set, but daily usage exposes
friction:
- "Where did I see that quote about cognition?"
- "I want to mark this passage as worth re-reading."
- "Why can't I search across my whole library?"
- "I want to read in sepia tonight."

Each individual QoL feature is small, but together they're what
distinguishes a tool from a delight. This is the polish phase.

## Prerequisites

- Phase M (a modular codebase makes these features tractable).

## Deliverables

- Full-text search across the library (worker-driven).
- In-text annotations: select, highlight, add note.
- Spaced repetition (SM-2) for flashcards and quiz wrong answers.
- Theming: dark / light / sepia / system.
- Adjustable typography (font, size, line-height, column width).
- Reading position memory (resume where you left off).
- Word definitions on tap (Wiktionary API).
- Streak heatmap (GitHub-contribution-style calendar).
- Folders / collections.
- Multi-tag AND/OR/NOT filtering.
- Library sort options.
- URL/web article import (Readability-based).
- DOCX / TXT import.
- Reading reminders via push notifications.
- Quiz export to Anki / Quizlet CSV.

## Task breakdown

### N1 — Full-text search

Worker:
```ts
// src/workers/search.worker.ts
import lunr from 'lunr';
let index: lunr.Index;

export const api = {
  async build(chapters: Chapter[]) {
    index = lunr(function() {
      this.field('title', { boost: 5 });
      this.field('content');
      this.ref('id');
      for (const ch of chapters) this.add(ch);
    });
  },
  async query(q: string) {
    return index.search(q).map(r => r.ref);
  }
};
```

UI: command-palette (Cmd/Ctrl+K) with fuzzy search across:
- Books (title, author, tags)
- Chapters (title, content)
- Generated content (summaries, feed posts) — optional

Highlight matches in the result rows. Tap → open chapter with the
match scrolled into view + visually highlighted.

Index is rebuilt on import / chapter edit; cached in IDB.

### N2 — In-text annotations

New IDB store: `annotations` keyed by `id`:
```ts
{
  id: 'ann_<ts>',
  chapterId,
  start: number,        // char offset
  end: number,
  color: 'yellow' | 'pink' | 'green' | 'blue',
  note?: string,
  createdAt: ISO
}
```

UI:
- Select text in the Read view → context menu with:
  - Highlight (4 colors)
  - Add note (highlight + textarea)
  - Copy
  - Ask AI ("explain this passage")
- Annotated spans render as `<mark>` with `data-ann-id`.
- Click an annotation → opens the note panel.
- Sidebar lists all annotations for the chapter / book.

Sync via Drive (extends Phase F whitelist).

### N3 — Spaced repetition

Implement SM-2 (Anki algorithm):
```ts
type Card = {
  id: string;
  type: 'flashcard' | 'quiz';
  ref: string;          // flashcard id or quiz question id
  ease: number;         // 1.3+
  interval: number;     // days
  nextReview: string;   // ISO date
};
```

UI: a "Review" tab in the library that shows cards due today.

For wrong quiz answers, auto-add to the review deck.

User feedback per card: Hard / Good / Easy → updates ease & interval.

Daily review counter in the streak / stats area.

### N4 — Theming

CSS variables refactor:
```css
[data-theme=dark] { --bg-deep: #0f0f1a; --text-primary: #f0f0f5; ... }
[data-theme=light] { --bg-deep: #ffffff; --text-primary: #111; ... }
[data-theme=sepia] { --bg-deep: #f4ecd8; --text-primary: #5b4636; ... }
```

Setting: `theme` ∈ `system | dark | light | sepia`. `system` follows
`prefers-color-scheme`.

PDF viewer page background follows theme too (sepia tint for PDFs).

### N5 — Adjustable typography

Settings:
- `fontFamily`: DM Sans / Crimson Pro / system serif / system sans /
  Atkinson Hyperlegible / dyslexic-friendly (OpenDyslexic).
- `fontSize`: small / medium / large / huge.
- `lineHeight`: 1.4 / 1.6 / 1.8 / 2.0.
- `columnWidth`: 600px / 720px / 840px / wide.
- `letterSpacing`: 0 / 0.02em / 0.05em.

Apply to the Read view. Live preview while adjusting.

### N6 — Position memory

Save scroll position per chapter:
```ts
// settings: `reading_pos_<chapterId>` = { offset: number, ts: ISO }
```

Throttle writes (max 1 every 2s).

On chapter open, restore. Show a "Resume from where you left off?"
button if the position is non-zero.

### N7 — Word definitions

Tap a word in the Read view → mini-popover with:
- Pronunciation (if available).
- Part of speech + definition (Wiktionary REST API):
  ```
  GET https://en.wiktionary.org/api/rest_v1/page/definition/<word>
  ```
- "Explain in context" button → AI prompt scoped to the surrounding
  paragraph.

Cache definitions locally (free Wiktionary tier has rate limits).

### N8 — Streak heatmap

GitHub-style year calendar showing daily completion counts.

Render as a 53×7 SVG grid with cells colored by intensity (0–4
chapters / day → 5 levels).

### N9 — Folders / collections

New IDB store: `collections`:
```ts
{ id, name, bookIds: [...], emoji, addedAt }
```

UI:
- Library has a sidebar (or top picker) with collection chips.
- "Create Collection" button.
- Drag-and-drop books into collections (or use multi-select +
  "Add to collection").

A book can belong to multiple collections.

### N10 — Tag filtering with logic

Replace simple tag chips with a filter builder:
- "Show books that have **all of**: A, B"
- "Show books that have **any of**: A, B, C"
- "Hide books with: D"

Boolean filter expression compiled to a predicate.

### N11 — Sort options

Library sort dropdown: Recently added / Recently read / Alphabetical
(title) / Alphabetical (author) / Completion %.

### N12 — URL / web article import

`/api/fetch-article/proxy.js` (new edge function):
- Accept a URL.
- Fetch with `User-Agent: Mozilla/...` to avoid bot blockers.
- Parse with `@mozilla/readability` server-side.
- Return `{ title, content, byline, siteName }`.

Client UI: "Add from URL" in the import flow.

### N13 — DOCX / TXT import

DOCX: `mammoth.js` to convert to clean HTML, then strip to text.
TXT: just read as text.

Both feed into the Phase I chapter detection cascade.

### N14 — Reading reminders (push notifications)

Browser push (already wired in Phase A's SW):
- Settings → Reminders → "At 8am daily".
- Schedule via the Notifications API.
- The SW's `push` handler shows the notification.
- Click "Read" → open the daily card chapter.

(For Web Push to work without a server, use the Periodic Background
Sync API where supported; otherwise the user gets reminders only
when the page is open.)

### N15 — Anki / Quizlet export

Quiz export:
- Generate CSV `front,back,deck` with all flashcards across the
  library.
- Anki import: clipboard-friendly format.
- Quizlet import: TSV format.

Settings → "Export to Anki" / "Export to Quizlet".

## Acceptance criteria

- [ ] Search returns relevant results across a 50-book library in
      under 100 ms (after index build).
- [ ] Annotations survive close-and-reopen and sync across devices.
- [ ] Spaced repetition surfaces due cards in a Review tab.
- [ ] Theming applies instantly without reload.
- [ ] Position memory restores chapter to last scroll point.
- [ ] Word definition popover shows for a tapped word.
- [ ] Streak heatmap renders accurately for the year.
- [ ] Collections persist and sync.
- [ ] AND/OR/NOT filters work as expected.
- [ ] Anki export imports cleanly into Anki.

## Effort estimate

- **T-shirt:** L
- **Person-weeks:** 4–6
- **Critical path:** annotations (selection + storage + render) +
  search index.

## Risks & unknowns

- **Selection range** persistence is fiddly because chapter content
  may be re-formatted (Phase B's Format dialog). Use a robust offset
  algorithm or store text + position-hint pairs.
- **Wiktionary rate limits** — cache aggressively.
- **Push notifications** are unreliable on iOS Safari. Document the
  caveat.
- **DOCX / TXT** chapter detection may need different defaults.

## Out of scope

- Multi-cloud sync (Phase O).
- Local TTS (Phase P).
- Knowledge graph (Phase Q).
- Browser extension for "save to library" (Phase R).

## Decision points before Phase O

- [ ] Confirm whether to ship word definitions in this phase or defer
      to a later polish round.
- [ ] Decide on the scoring algorithm for spaced repetition (SM-2 is
      proven; FSRS is more accurate but more complex).

---

Continue to [Phase O — Cloud & Sync Plus](phase-o-sync-plus.md).
