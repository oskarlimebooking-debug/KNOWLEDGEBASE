# 11 — Mind Map, Socratic Dialogue, and Chat

These three modes are grouped because they all share an interactive,
context-grounded interface. The underlying AI prompt is different but the
plumbing is similar.

## Mind Map (`loadMindmapContent`)

`index.html:17160`. Generates a JSON tree (`mindmap` prompt,
`index.html:9769`):

```json
{
  "center": "Main Chapter Topic",
  "branches": [
    {
      "title": "Main Theme 1",
      "color": "#FF6B6B",
      "subbranches": [
        { "title": "Subtopic 1.1", "items": ["detail 1", "detail 2"] },
        ...
      ]
    },
    ...
  ]
}
```

5 fixed colors are cycled: `#FF6B6B`, `#4ECDC4`, `#45B7D1`, `#FFA07A`,
`#98D8C8`.

### Renderer (`renderMindmap`)

`index.html:17235`. Hand-rolled SVG layout:

- Center node placed at SVG center.
- Branches radiate outwards in even-angle slices.
- Sub-branches stack vertically, anchored to their branch.
- Leaf items are bullet-text adjacent to sub-branches.
- Colored connecting lines.
- Mobile-friendly via responsive viewBox.

`regenerateMindmap()` clears the cache and re-runs.

### Book mind map

`openBookMindmap()` (`index.html:18608`) does the same for a whole book.
Cached as `book_mindmap_<bookId>`.

## Socratic dialogue (`loadSocraticContent`)

`index.html:16905`. Multi-turn chat where the AI is constrained to ask
**questions** rather than give answers.

System prompt (embedded in `startSocraticSession`, `index.html:16960`):

> You are a Socratic tutor. Never give the answer directly. Probe with
> questions. Build on the student's previous answers. After 5 exchanges,
> offer a synthesis only if the student is stuck.

Storage: the conversation is held in a session-scoped array
`socraticHistory` rendered as chat bubbles. Persisted to
`socratic_<chapterId>` so users can resume.

`sendSocraticMessage()` (`index.html:17043`) pushes user input + AI reply,
re-renders, scrolls to bottom.

## Chat (in-chapter, `loadChatContent`)

`index.html:18272`. The "💬 Ask" tab. Inline chat bound to the chapter's
text. The system prompt clamps the AI: "Answer only from the chapter
content. If the answer isn't there, say so."

`sendChapterChatMessage()` (`index.html:18364`) dispatches via `callAI`
with `chapter.content` injected as context.

## Book chat (full-screen modal)

`openAIChat('book')` (`index.html:18318`). Uses the book detail "Ask the
Book" button. All chapters concatenated as context (truncated at the model
limit). The chat persists for the session but is not cached to IDB by
default.

## Batch chat (`openBatchChat`)

`index.html:25961`. Multi-book chat:

1. User selects multiple books from the library.
2. Click "Ask Books".
3. Modal lists the selected book "tags".
4. User can add/remove books on the fly.
5. Send a question — combined context is composed from all book contents.
6. AI dispatches via `callAI`. The DocAnalyzer provider is special-cased
   here: each book is uploaded as a doc and the question is asked against
   each one then synthesized.

Cached implicitly because the batch chat doesn't store history beyond the
session.

## DocAnalyzer special path

When the active provider is DocAnalyzer, the chat flow uploads the
chapter/book content as a temporary document, asks the question, deletes
the doc afterward (see [`16-ai-providers.md`](16-ai-providers.md) for the
full `callDocAnalyzerAPI` flow).

## Streaming responses

For Merlin (which has a true SSE stream), the chat could stream tokens —
but the current implementation buffers the full response and renders at
the end. This is a known UX gap; see
[`24-future-development.md`](24-future-development.md).

## UI behavior shared by all chat modes

- **Auto-scroll** to bottom on new message.
- **Enter to send**, Shift+Enter for newline.
- **Loading dots** rendered as a separate AI message during the call.
- **Error message** as a system-style red bubble on failure.
- **`formatChatMessage(text)`** (`index.html:18599`) renders inline
  markdown (bold, italic, code) without permitting block elements.

Continue to [`12-tts-and-listen.md`](12-tts-and-listen.md).
