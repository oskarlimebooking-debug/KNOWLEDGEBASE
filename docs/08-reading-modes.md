# 08 — Reading Modes

When the user opens a chapter, the chapter view shows 11 mode tabs along
the top. Each tab lazy-loads its content via `switchMode(mode)` →
`loadModeContent(mode)` (`index.html:14262`).

```
loadModeContent(mode)
 ├─ 'read'        → render formatted HTML body
 ├─ 'listen'      → loadListenContent()        (see 12-tts-and-listen.md)
 ├─ 'chat'        → loadChatContent()          (see 11)
 ├─ 'simplified'  → loadSimplifiedContent()
 ├─ 'quiz'        → loadQuizContent()          (see 09-quiz-modes.md)
 ├─ 'flashcards'  → loadFlashcardsContent()
 ├─ 'teachback'   → loadTeachbackContent()
 ├─ 'socratic'    → loadSocraticContent()      (see 11)
 ├─ 'mindmap'     → loadMindmapContent()       (see 11)
 ├─ 'feed'        → loadFeedContent()          (see 10-feed-system.md)
 └─ 'video'       → loadVideoContent()         (see 14-vadoo-video.md)
```

Each loader follows the same cache-first pattern:

```js
let cached = await dbGet('generated', `<type>_${chapter.id}`);
if (!cached) {
  // show spinner
  cached = await generateX(chapter.content, chapter.title, apiKey);
  await dbPut('generated', { id, chapterId, type, data, generatedAt });
}
renderX(cached.data);
```

## 📖 Read

The simplest mode. Reads `chapter.content`, runs it through the in-house
markdown / HTML renderer, sanitizes, displays.

If the chapter has a `formattedHtml` from the Format dialog, that is shown
verbatim instead.

The read view also exposes:
- **Mark Complete** button at the bottom (writes to `progress` store).
- **Previous / Next chapter** navigation (auto-loads the next chapter).

## 🎧 Listen

See [`12-tts-and-listen.md`](12-tts-and-listen.md). Three TTS providers,
unified player, persistent mini-player.

## 💬 Ask

See [`11-mindmap-socratic-chat.md`](11-mindmap-socratic-chat.md). Inline
chat overlaying the chapter content, scoped to the chapter as context.

## 💡 Summary (`loadSimplifiedContent`)

`index.html:14659`. Calls `generateSummary(content, title, apiKey)`
(`index.html:12228`) which runs the `summary` prompt and parses JSON:

```json
{
  "keyConcepts": ["string", ...],   // 3-5 items
  "summary": "2-3 paragraph plain text",
  "difficulty": 1-5,
  "readingTime": <minutes>
}
```

Renders as:

- A row showing reading time + difficulty stars.
- "Key Concepts" pills at the top.
- The summary text below, run through `formatContent`.

The chapter row's `difficulty` is also written back to its IDB record so
the library card can display it.

## ❓ Quiz

See [`09-quiz-modes.md`](09-quiz-modes.md) — six modes including Speed,
Fill-Blanks, Devil's Advocate, Connections, Who-Am-I.

## 🃏 Flashcards (`loadFlashcardsContent`)

`index.html:16739`. Generates 5–8 flashcards via `generateFlashcards`.

Schema:

```json
{ "flashcards": [ { "front": "Q?", "back": "A." } ] }
```

UI:
- Card with click-to-flip animation (CSS).
- Prev / Next buttons.
- Counter "3 / 8".
- "More cards" button → re-runs the generator with a "do not repeat the
  existing cards" addendum.

## 🎓 Teach Back (`loadTeachbackContent`)

`index.html:16831`. Implements the **Feynman technique**:

1. Show a textarea: "Explain what you learned about [chapter title]…"
2. User types and submits.
3. AI grades via `evaluateTeachback` → JSON
   `{ strengths, gaps, suggestions, score }`.
4. Display the grade with a 1–10 score badge.

Cached as `teachback_<chapterId>` so the user can revisit their last
explanation.

## 🤔 Socratic (`loadSocraticContent`)

See [`11-mindmap-socratic-chat.md`](11-mindmap-socratic-chat.md). Multi-turn
dialogue where the AI asks probing questions to deepen understanding.

## 🧠 Mind Map (`loadMindmapContent`)

See [`11-mindmap-socratic-chat.md`](11-mindmap-socratic-chat.md). SVG mind
map with 3–5 main branches and sub-branches per chapter.

## 📱 Feed

See [`10-feed-system.md`](10-feed-system.md). 20 social-media-style posts
with 7 personalities, hashtags, image generation, and per-post deep-dive
writeups.

## 🎬 Video

See [`14-vadoo-video.md`](14-vadoo-video.md). Generates a TikTok/Reels-style
short video using Vadoo AI.

## Chapter navigation

Each chapter view shows `← Back` to go to the book detail. Within the
chapter, the next chapter is reached either by:

- Tapping a chapter in the breadcrumb (when shown).
- Auto-advance from the audio player when the chapter ends and "auto-next"
  is on.
- Listen mode's `persistentNextChapter()` (`index.html:20421`).

## Mark complete

`toggleChapterComplete()` (`index.html:14236`):

```js
{
  id: <chapterId>,
  bookId: <bookId>,
  chapterId: <chapterId>,
  completed: true,
  completedAt: ISO,
  date: 'YYYY-MM-DD'
}
```

Used by:
- The library "today's chapter" card.
- The streak counter (`calculateStreak`).
- The book detail's progress percentage.

Continue to [`09-quiz-modes.md`](09-quiz-modes.md).
