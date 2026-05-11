# Phase K — Video Generation and Image Provider Plus

> **Tagline:** TikTok-style videos and a second image provider.

## Goal

Add Vadoo AI integration for vertical short-form video generation
(per chapter or for a whole book), and add Bonkers (via Merlin) as a
second image provider for the feed and AI cover regeneration.

## Why this phase / rationale

The video generation feature is **the wow moment**. A user picks a
chapter, taps Generate Video, and receives a viral-style 60-second
short with hook / build / payoff structure, captions, and AI narration.
Even though it's not part of daily reading flow, having it elevates
the app's perceived value.

Bonkers is added because Gemini's image generation is uneven; having
a second provider with different aesthetics gives users options.

## Prerequisites

- Phases A–H.
- Phase H specifically: Vercel proxy infrastructure + Merlin auth.
- Phase D: image generation primitives.

## Deliverables

- 🎬 Video tab on the chapter view.
- Vadoo provider (proxied via `/api/vadoo/proxy`).
- Six viral-script personas for video narration.
- Per-duration character-limit enforcement.
- 15-second poll loop with status UI.
- Book-level video modal (multi-chapter video generation).
- Bonkers image provider via Merlin's `wallflower/unified-generation`.
- Image provider switch in settings.
- AI cover regeneration (uses image provider).
- Vadoo balance display in settings.

## Task breakdown

### K1 — Vadoo client

```js
const VADOO_API = '/api/vadoo/proxy';

async function vadooFetch(endpoint, { method, params, body } = {}) {
  let url = `${VADOO_API}?endpoint=${encodeURIComponent(endpoint)}`;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    }
  }
  const r = await fetch(url, {
    method, headers: {
      'X-Api-Key': await getSetting('vadooApiKey'),
      'X-Vadoo-Endpoint': endpoint,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Vadoo API error: ${r.status}`);
  }
  return r.json();
}
```

Endpoints:
- `get_my_balance` → credits
- `get_voices` → voice array
- `generate_video` (POST) → `{ vid }`
- `get_video_url?id=<vid>` → `{ status, url }`

### K2 — Viral script personas

Hard-coded array of 6 personas:
1. The Shocked Narrator
2. The Storyteller
3. The Conspiracy Uncoverer
4. The Rapid-Fire Expert
5. The Emotional Hook
6. The Debate Starter

Each has a `name` + `style` description used in the script prompt.

### K3 — Script generation

```js
async function generateVideoFromContent(content, title, options) {
  const duration = options.duration || await getSetting('vadooDuration');
  const durationLimits = {
    '30-60': 1000, '60-90': 1500, '90-120': 2000,
    '120-180': 2500, '5 min': 5000, '10 min': 10000
  };
  const maxChars = durationLimits[duration];
  const targetChars = Math.floor(maxChars * 0.85);

  const persona = randomPick(viralPersonas);

  const prompt = buildScriptPrompt({ persona, title, content, targetChars });
  const script = await callAI(prompt, await getSetting('apiKey'), null,
                              { temperature: 0.9 });

  let cleanScript = script.replace(/```[a-z]*\n?|\n?```/g, '')
                          .replace(/^["']|["']$/g, '').trim();
  if (cleanScript.length > maxChars) {
    cleanScript = truncateAtSentence(cleanScript, maxChars);
  }

  const vid = await generateVadooVideo(cleanScript, options);
  return { vid, script: cleanScript };
}
```

Prompt rules:
- Output ONLY spoken words.
- HARD character limit.
- Hook in first 3 seconds.
- End with thought-provoking question or memorable one-liner.
- Pattern interrupts every 15-20 seconds.
- Open loops ("but wait, it gets crazier").
- Specific numbers and names.
- Conversational (write for the ear).

### K4 — Polling

```js
async function pollVadooVideo(vid, statusCallback) {
  for (let i = 0; i < 120; i++) {
    const result = await checkVadooVideoStatus(vid);
    statusCallback(result.status, i);
    if (result.status === 'completed') return result.url;
    if (result.status === 'failed') throw new Error('Video generation failed');
    await sleep(15000);
  }
  throw new Error('Video generation timed out');
}
```

UI: live status text "Vadoo is generating… 4m elapsed". Cancel button
(UI only — Vadoo job continues server-side).

### K5 — Video tab UI

`loadVideoContent(chapter)`:
- If cached: show `<video>` player + script + regenerate / delete.
- Else: button "Generate Video" + poll UI.

Cache: `video_<chapterId>` row with `{ videoUrl, script, title,
generatedAt }`.

### K6 — Book Video modal

Multi-chapter video flow:
- Modal opens from book detail.
- User selects which chapters to video-ify.
- Pre-flight check on Vadoo balance.
- Sequential queue (one video at a time).
- Per-chapter cache key: `book_video_<bookId>_<chapterId>`.

### K7 — Vadoo settings

```
vadooApiKey
vadooDuration   '30-60' | '60-90' | '90-120' | '120-180' | '5 min' | '10 min'
vadooVoice      from get_voices
vadooStyle      'cinematic' | 'anime' | 'realistic' | ...
vadooTheme      'Hormozi_1' | ...
vadooAspect     '9:16' | '1:1' | '16:9'
```

Live balance display when key is set:
```js
const credits = await checkVadooBalance();
document.getElementById('vadoo-credits-count').textContent = credits;
```

### K8 — Bonkers provider (via Merlin)

```
POST https://www.getmerlin.in/arcane/api/v1/wallflower/unified-generation
Authorization: Bearer <merlinIdToken>
Content-Type: application/json

{
  "prompt": "<imagePrompt>",
  "model": "bonkers-advance",
  "size": "1024x1024" | "1024x1792" | "1792x1024",
  "n": 1
}
```

Response: `{ urls: ["https://merlin.cdn/..."] }`. The URL is fetched
and inlined as base64 (so it survives Merlin URL rotation).

### K9 — Image provider switch

`getSetting('imageProvider')` → `'gemini'` (default) or `'bonkers'`.

Settings UI:
- Provider dropdown.
- Conditional config blocks: `#gemini-image-settings` and
  `#bonkers-image-settings`.
- For Bonkers: model variant dropdown
  (`bonkers-advance`, `bonkers-quality`, etc.).

`generateFeedImage(prompt, apiKey)` (Phase D) routes via the chosen
provider.

### K10 — AI cover regeneration

Augment Phase A's cover generation:
- "Regenerate cover" button on book detail.
- Three options:
  - Reset to PDF page 1.
  - Reset to emoji.
  - Generate AI cover (uses the chosen image provider).
- AI cover prompt template:
  `"Book cover for '${title}' by ${author}. Style: contemporary
  nonfiction. No text on the cover."`
- Resulting JPEG saved to `book.coverImage`.

### K11 — Sync extension

Add to `syncableSettingKeys`:
```
imageProvider, imageModel, bonkersImageModel,
vadooApiKey, vadooDuration, vadooVoice, vadooStyle, vadooTheme, vadooAspect
```

## Acceptance criteria

- [ ] User configures Vadoo, taps Generate Video, gets a real video.
- [ ] Polling shows live progress and times out at 30 minutes.
- [ ] Cached video displays inline on re-open.
- [ ] Book video modal generates 3 videos in sequence.
- [ ] Bonkers generates an image when the provider is switched.
- [ ] AI cover regeneration produces a clean cover.
- [ ] Vadoo balance shows correctly.
- [ ] Vercel proxy doesn't introduce CORS issues.

## Effort estimate

- **T-shirt:** M
- **Person-weeks:** 2–3
- **Critical path:** script prompt iteration (the model frequently
  produces non-spoken content if not policed).

## Risks & unknowns

- **Vadoo URL expiry** — generated MP4 URLs may not persist forever.
  Cache the URL but consider downloading the binary in Phase R.
- **Polling cost** — Vercel function executions for 30-minute polls
  can add up. Move polling to the client (already done) and leave
  the proxy to forward only the active call.
- **Bonkers quality** is uneven; expect manual prompt iteration.
- **Vadoo cost** — videos consume Vadoo credits. Surface the cost
  per video estimate before generation.
- **NSFW concern** — feed personalities can produce edgy content;
  passing it as a video script may violate Vadoo's TOS. Add a
  content-safety check on the script before submission.

## Out of scope

- Self-hosted video generation via FFmpeg.wasm (Phase R).
- DALL·E / Midjourney / Replicate providers (Phase R).
- Video timing / subtitle editing in-app (Phase R).
- Per-chapter custom thumbnails (Phase R).

## Decision points before Phase L

- [ ] Decide whether to lazy-download video MP4 to OPFS (recommended
      after Phase M).
- [ ] Decide whether to add a "content safety" filter on scripts
      before they reach Vadoo.

---

Continue to [Phase L — Cross-Book Intelligence](phase-l-cross-book.md).
