# Phase D — Feed System

> **Tagline:** Twenty social-media posts per chapter, twelve distinct voices.

## Goal

Generate a Twitter/X-style feed of 20 posts per chapter, written in
**12 different fictional personalities** (7 from pre-merger Headway + 5
absorbed from ThesisCraft), with optional AI images and deep-dive
writeups. This is the app's signature feature.

Phase D, post-merger, adds the 5 ThesisCraft personalities (`researcher`,
`critic`, `practitioner`, `philosopher`, `journalist`) as opt-in
extensions to the original Headway 7 (`professor`, `hype`, `contrarian`,
`unhinged`, `nurturing`, `storyteller`, `meme`). Default rotations vary
by source kind (book / article / url / note).

See [`docs/10-feed-system.md`](../10-feed-system.md) for the unified
personality table.

## Why this phase / rationale

The feed is what makes ChapterWise stand out. It transforms passive
study into an entertainment experience. Building it requires:

- A long, well-structured prompt that enforces personality diversity.
- A robust JSON parser (the model occasionally produces invalid JSON).
- Per-personality image generation styles.
- A long-form writeup mode that maintains the same voice as the post.

This is also where the **JSON repair** infrastructure earns its keep —
a single broken post should not break the whole feed.

## Prerequisites

- Phase B (cache pattern, callAI).
- Phase C (sanitizer, conversation-style rendering).

## Deliverables

- 📱 Feed mode tab on the chapter view.
- Feed generation with 7 personalities and 20 posts.
- Twitter/X-style card UI.
- Per-post image generation (3 of 20 marked `hasImage`).
- Deep-dive writeup modal for posts with `hasLink` (5–6 of 20).
- Feed JSON robust parser with auto-repair fallback.
- "Generate more posts" appends to the cache.
- Like/retweet UI state persisted per chapter.
- Image generation via Gemini image-out (Bonkers via Merlin in Phase K).

## Task breakdown

### D1 — Personality system

Hard-coded list of **12 personalities** (post-merger), each with:
- `code` — one of: `professor`, `researcher`, `hype`, `contrarian`,
  `critic`, `unhinged`, `nurturing`, `storyteller`, `meme`,
  `practitioner`, `philosopher`, `journalist`
- Voice description (used in prompts and writeup generators).
- Username pool (4 examples each).
- Image style hint (used to seed `imagePrompt`).
- Origin marker (Headway / ThesisCraft / new) — informational.

Active personality rotation is configurable per project + per source
kind. Defaults:
- `book` → 7 Headway core (professor, hype, contrarian, unhinged,
  nurturing, storyteller, meme)
- `article` → professor, researcher, critic, contrarian, practitioner,
  storyteller, philosopher
- `url` → journalist, hype, contrarian, meme, storyteller
- `note` → nurturing, philosopher, storyteller

Document this in `lib/personalities.js` (or `.ts`) so writeup mode and
image gen reuse the same values.

### D2 — Feed prompt

Build the canonical feed prompt with:

- Chapter title + content.
- Total post count (default 20, configurable via `feedPostCount` setting).
- Cadence: 3-4 professor, 2-3 hype, 3-4 contrarian, 2-3 unhinged, 2-3
  nurturing, 2-3 storyteller, 2-3 meme.
- 3-4 thread posts ("🧵 Thread:" openers).
- 3 posts with `hasImage: true`.
- 5-6 posts with `hasLink: true`.
- 3-4 marked `isViral: true`.
- Hashtag injection rules.
- Per-personality image-prompt style hints.
- Strict JSON output schema.

The prompt is large (10k+ chars). Save it as `prompt_feed` in defaults
and let the user override.

### D3 — Robust JSON parser

`parseFeedJson(rawResponse)` strategy:

1. Strip ```json fences.
2. Try `JSON.parse` directly.
3. Use a non-greedy regex to find the first `{...}` block.
4. Walk character-by-character counting brace depth to find a valid
   JSON object.
5. If all fail: call `attemptFixChapterFeedJson(raw)` which sends the
   broken JSON back to the AI with "Fix this JSON" instructions.
6. Return parsed object or throw with a usable error message.

This helper should also handle the book and multi-book feed shapes
(Phase L extends to those).

### D4 — Feed renderer

For each post, render a Twitter/X-style card:

- Avatar (single emoji from the post).
- Username + handle row.
- "n hours/days ago" badge from `getRandomTimeAgo()`.
- Post content with newlines preserved and `#hashtag` highlighted.
- Action row: Reply, Retweet, Like, Share, Views.
- Number formatting: `1.2k`, `45.3k`, `2.1M` via `formatNumber()`.

Special states:
- Viral badge (orange flame icon).
- Image placeholder when `hasImage: true` (lazy-load on click).
- "Read deep dive" link button when `hasLink: true`.

### D5 — Image generation

- `generateFeedImage(prompt, apiKey)` dispatches via the configured
  image provider (Gemini for Phase D; Bonkers added in Phase K).
- Gemini image flow:
  - Detect image-capable models via the models endpoint.
  - Call `callGeminiAPI(prompt, ..., { responseMimeType: 'image/jpeg' })`.
  - Read base64 from `inlineData.data`.
- On success: store back into the cached feed JSON under
  `posts[i].imageUrl` and re-render that card.
- On failure: revert to placeholder + show error toast.

### D6 — Deep-dive writeup modal

Triggered by `hasLink: true` posts.

- Full-screen overlay.
- Header: personality avatar + handle.
- Body: rendered markdown of an 800–1500 word article in the
  personality's voice.
- Generate via `generateWriteup(topic, chapterTitle, bookTitle, content,
  apiKey, username, personality)`.
- Personality guide injected as a prompt fragment so the AI matches
  voice (the seven different prompt fragments are in
  `lib/personalities.js`).
- Cache as `writeup_<chapterId>_<topic>_<personality>`.

### D7 — Like / retweet state

- Save to `liked_posts_<chapterId>` setting key as a `Set<postId>`.
- Toggling persists immediately.
- Re-opens restore the liked state.

### D8 — Generate more posts

- Button "More posts" on the feed.
- Sends a follow-up prompt with the existing post topics + a
  "do not repeat" instruction.
- Appends to the cached `posts` array.

### D9 — Regenerate feed

- Delete the cache row, fire generation again.
- Confirm dialog because it loses likes / generated images.

### D10 — Settings

- `feedPostCount` (default 20, range 10–40).
- `imageProvider` (default `gemini`, only option for now).
- `imageModel` (auto-detected via models endpoint).

### D11 — Library extension: feed cache awareness

When a feed exists for a chapter, the chapter list shows a small "📱"
indicator. Helps users navigate.

## Acceptance criteria

- [ ] Feed generates 20 posts in roughly the requested personality
      cadence.
- [ ] Card UI looks recognizably "Twitter-like" on mobile and desktop.
- [ ] Image generation produces a JPEG that displays inline.
- [ ] Deep-dive writeup matches the personality (manual sanity check).
- [ ] Liking a post persists across page reloads.
- [ ] "More posts" appends without breaking existing post IDs.
- [ ] JSON repair fallback fires when given a malformed feed (test with
      a fixture).
- [ ] Regeneration confirms with the user before destroying state.

## Effort estimate

- **T-shirt:** L
- **Person-weeks:** 4–6
- **Critical path:** prompt iteration and the JSON parser.

## Risks & unknowns

- **Prompt fragility** — the feed prompt is the longest in the app and
  the most likely to drift. Build a "test fixtures" folder with 3
  sample chapters and a snapshot test that re-runs every prompt
  change.
- **Image generation quality** is uneven on Gemini today. Phase K
  adds Bonkers as an alternative.
- **Token cost** — 20 posts + 8 images is expensive. Add a spinner
  with cost estimate to set expectations.
- **Generation time** — full feed can take 30–60 s. Make sure the UI
  doesn't appear stuck.
- **Inappropriate output** — `unhinged` and `meme` personalities push
  edges. Add a content-policy notice in settings; consider an
  optional family-friendly mode that disables certain personalities.

## Out of scope

- Book-level feed (Phase L).
- Multi-book feed (Phase L).
- Cross-book feed (Phase L).
- Bonkers image provider (Phase K).
- Custom user-defined personalities (Phase Q).
- Feed timeline across all books (Phase R).

## Decision points before Phase E

- [ ] Confirm the personality system is final. Adding personalities
      later is fine; renaming codes is breaking.
- [ ] Decide on image storage strategy: inline base64 (current app's
      choice) vs OPFS file references. OPFS is recommended if Phase M
      already happened; otherwise inline.
- [ ] Confirm that `feed_<chapterId>` cache shape is what the rest of
      the app will read. Phase L's book-feed reuses it.

---

Continue to [Phase E — TTS & Persistent Player](phase-e-tts-and-player.md).
