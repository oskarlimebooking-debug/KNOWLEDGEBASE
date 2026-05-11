# Sprint D: Feed System — 20 posts/chapter, 12 personalities

> One task per T-item in `docs/implementation-plan/phase-d-feed-system.md`.
> The app's signature feature. Twitter/X-style social feed per chapter with 7 Headway + 5 ThesisCraft personalities.

### Phase 1: Personality system + prompt + parser

### TD.1 -- Personality system (12 voices) | Cx: 8 | P0

**Description:** Hard-coded list of 12 personalities (post-merger): `professor`, `researcher`, `hype`, `contrarian`, `critic`, `unhinged`, `nurturing`, `storyteller`, `meme`, `practitioner`, `philosopher`, `journalist`. Each with `code`, voice description, username pool (4 each), image-style hint, origin marker. Active rotation configurable per project + per source kind. Document in `src/lib/personalities.ts`.

**AC:**
- [ ] All 12 personality records present and validated by zod
- [ ] Defaults: book → 7 Headway core; article → 7 academic-leaning; url → 5 journalist-mix; note → 3 reflective
- [ ] Used identically by feed prompt + writeup generator + image gen (single source of truth)
- [ ] Snapshot test on the personality list (renames are breaking)

**Depends on:** TA.2

### TD.2 -- Feed prompt builder | Cx: 13 | P0

**Description:** Construct the canonical feed prompt: chapter content + total post count (default 20) + cadence (3–4 professor, 2–3 hype, 2–3 contrarian, 2–3 unhinged, 2–3 nurturing, 2–3 storyteller, 2–3 meme) + 3–4 threads + 3 `hasImage` + 5–6 `hasLink` + 3–4 `isViral` + hashtag rules + per-personality image-style hints + strict JSON schema. Prompt template stored as `prompt_feed` default; user-overridable.

**AC:**
- [ ] Prompt is built deterministically from inputs (same chapter → same prompt)
- [ ] Cadence enforced (Vitest snapshot on prompt body)
- [ ] User override saved in `prompt_feed` setting overrides default
- [ ] 10k+ char prompt doesn't trigger model context limit on Gemini Flash

**Depends on:** TD.1, TB.2

### TD.3 -- Robust JSON parser (parseFeedJson) | Cx: 13 | P0

**Description:** Strategy: (1) strip ```json fences, (2) `JSON.parse` directly, (3) non-greedy regex first `{...}` block, (4) char-by-char brace-depth walk, (5) call `attemptFixChapterFeedJson(raw)` which sends broken JSON back to AI for repair, (6) return parsed or throw with usable message. Also handles book / multi-book feed shapes (Phase S extends).

**AC:**
- [ ] All 5 strategies covered by unit tests
- [ ] Malformed-JSON fixture (truncated, trailing prose, mixed fence) all repair successfully
- [ ] Repair fallback gated by feature flag for offline dev
- [ ] Parser throws with the model's response excerpted when all strategies fail

**Depends on:** TB.1

### Phase 2: Feed UI + per-post features

### TD.4 -- Feed renderer (Twitter/X cards) | Cx: 8 | P1

**Description:** Per-post card: avatar (single emoji), username + handle, "n hours/days ago" via `getRandomTimeAgo()`, content with newlines preserved + `#hashtag` highlighted, action row (Reply, Retweet, Like, Share, Views). Number formatting `1.2k`, `45.3k`, `2.1M` via `formatNumber()`. Viral badge (orange flame). Image placeholder when `hasImage`. "Read deep dive" link when `hasLink`.

**AC:**
- [ ] 20-post feed renders smoothly on mid-tier mobile (60fps scroll)
- [ ] Number formatter covers 0..9.99M with stable rounding
- [ ] Viral badge visible only when `isViral: true`
- [ ] Action row icons are accessible (aria-labels)

**Depends on:** TD.3

### TD.5 -- Image generation (per-post) | Cx: 13 | P1

**Description:** `generateFeedImage(prompt, apiKey)` dispatches via configured image provider (Gemini for D; Bonkers added in R). Gemini flow: detect image-capable models, `callGeminiAPI` with `responseMimeType: 'image/jpeg'`, read base64 from `inlineData.data`. On success: store in cached feed JSON `posts[i].imageUrl`, re-render. On failure: placeholder + error toast.

**AC:**
- [ ] 3 posts get images on a fresh feed generation
- [ ] Image storage as base64 inline (OPFS migration deferred to G)
- [ ] Failure retains placeholder + offers Retry
- [ ] Cost estimate shown before batch image gen

**Depends on:** TD.4

### TD.6 -- Deep-dive writeup modal | Cx: 8 | P1

**Description:** `hasLink: true` posts trigger writeup. Full-screen overlay; header with personality avatar + handle. Body: rendered markdown of an 800–1500 word article in the personality's voice. `generateWriteup(topic, chapterTitle, bookTitle, content, apiKey, username, personality)` with personality fragment injected. Cache as `writeup_<chapterId>_<topic>_<personality>`.

**AC:**
- [ ] Writeup matches personality on manual A/B (3 fixtures)
- [ ] Cache hits return instantly
- [ ] Markdown rendered through Phase B sanitizer
- [ ] Modal closes on Escape; preserves scroll position on reopen

**Depends on:** TD.4, TB.9

### TD.7 -- Like / retweet state | Cx: 3 | P2

**Description:** Save to `liked_posts_<chapterId>` setting key as a `Set<postId>`. Toggle persists immediately. Re-opens restore liked state.

**AC:**
- [ ] Toggle is instant (optimistic UI)
- [ ] State persists across reload
- [ ] Drive sync (F) includes the key (deferred to F if not yet)
- [ ] Vitest covers serialization round-trip

**Depends on:** TD.4

### TD.8 -- Generate more posts (append) | Cx: 3 | P2

**Description:** "More posts" button sends follow-up prompt with existing topics + "do not repeat" instruction. Append to cached `posts` array.

**AC:**
- [ ] More posts appends without breaking existing post IDs
- [ ] Cadence maintained on appended batch
- [ ] No duplicate `id` collisions

**Depends on:** TD.4

### TD.9 -- Regenerate feed | Cx: 3 | P2

**Description:** Confirm dialog (loses likes / generated images). Delete cache row → fire generation again.

**AC:**
- [ ] Confirm before destruction
- [ ] Cache deleted before new request
- [ ] UI shows spinner during regen

**Depends on:** TD.4, TD.7

### TD.10 -- Settings additions | Cx: 3 | P2

**Description:** `feedPostCount` (default 20, range 10–40). `imageProvider` (default `gemini`). `imageModel` (auto-detected).

**AC:**
- [ ] Settings persist; takes effect on next generation
- [ ] Image-model dropdown loads from live endpoint
- [ ] Out-of-range values rejected with validation

**Depends on:** TA.8

### TD.11 -- Library: feed-cache indicator | Cx: 2 | P3

**Description:** When a feed exists for a chapter, chapter list shows a 📱 indicator.

**AC:**
- [ ] Indicator appears only when `feed_<chapterId>` exists in IDB
- [ ] Live updates on feed generation / deletion
- [ ] Doesn't break layout on chapters without feeds

**Depends on:** TD.4

---

## Sprint enforcement gates (must pass before Sprint E begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Tests** — `parseFeedJson` fuzz suite green; all 5 strategies exercised
- [ ] **G-Manual** — Snapshot tests added in `tests/feed-prompt-snapshots/` for the long prompt
- [ ] **G-Security** — content-policy notice in Settings for unhinged/meme personalities
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint E:**

- [ ] Confirm personality list is final (renames break cached writeups)
- [ ] Decide image storage: inline base64 (current) vs OPFS file references (recommended post-G)
- [ ] Confirm `feed_<chapterId>` cache shape (Sprint S reuses)
