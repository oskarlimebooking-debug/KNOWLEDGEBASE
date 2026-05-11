# 14 — Vadoo AI Video Generation

The Video tab generates **viral short-form vertical videos** from chapter
or book content using Vadoo AI's text-to-video service.

## Why a Vercel proxy?

Vadoo's API does not include CORS headers, so direct browser calls fail.
The app proxies all Vadoo traffic through `/api/vadoo/proxy.js` (see
[`21-vercel-proxies.md`](21-vercel-proxies.md)).

## Vadoo concepts

- **vid** — the video ID returned by `generate_video`.
- **Duration buckets** — `30-60`, `60-90`, `90-120`, `120-180`, `5 min`,
  `10 min`. Each has a hard character limit on custom scripts.
- **Voice** — Onyx, Echo, Nova, etc. (call `get_voices` for the live list).
- **Style** — cinematic, anime, realistic, and more.
- **Theme** — Hormozi_1 (the iconic green/red caption style), and others.
- **Aspect ratio** — `9:16` (default for shorts), `1:1`, `16:9`.

## The `vadooFetch` proxy client

`index.html:10908`. Sends every request to `/api/vadoo/proxy?endpoint=...`
with the user's API key in `X-Api-Key`. The proxy adds the actual Vadoo
URL via the `X-Vadoo-Endpoint` header.

```js
async function vadooFetch(endpoint, { method, params, body } = {}) {
  let url = `/api/vadoo/proxy?endpoint=${encodeURIComponent(endpoint)}`;
  if (params) url += '&' + new URLSearchParams(params);
  return fetch(url, {
    method, headers: {
      'X-Api-Key': apiKey,
      'X-Vadoo-Endpoint': endpoint,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
}
```

## Endpoints used

- `get_my_balance` → `{ credits }` (`checkVadooBalance`)
- `get_voices` → `[ "Onyx", ... ]` (`loadVadooVoices`)
- `generate_video` POST `{ topic, use_ai, prompt, duration, voice,
  language, aspect_ratio, style, theme }` → `{ vid }`
- `get_video_url?id=<vid>` → `{ status: pending|completed|failed, url }`

## Script generation (`generateVideoFromContent`)

`index.html:11042`. The most interesting bit. Three steps:

1. Pick a **viral persona** at random from a hard-coded list of 6:
   - The Shocked Narrator
   - The Storyteller
   - The Conspiracy Uncoverer
   - The Rapid-Fire Expert
   - The Emotional Hook
   - The Debate Starter
2. Build a script prompt that includes the persona's style guide, source
   content, the duration's character limit, and HARD RULES like
   - "Output ONLY spoken words. NO stage directions, NO [brackets]."
   - "MAXIMUM ${targetChars} characters."
   - "Start with a HOOK in the first 3 seconds."
   - "End with a thought-provoking question OR a memorable one-liner."
3. Call `callAI` with `temperature: 0.9` (high creativity).
4. Strip code-fence artifacts and quotes; truncate at the last full
   sentence if over the limit.

The generated script is then sent via `generateVadooVideo(scriptText)` to
Vadoo with `use_ai: 0` (raw script mode).

There's also `generateVadooVideoWithAI(topic)` which bypasses our prompt
and lets Vadoo write its own script from a topic.

## Polling (`pollVadooVideo`)

`index.html:11003`. 120 attempts × 15-second sleep = up to 30 minutes
maximum wait. Updates the UI through a status callback.

```js
for (let i = 0; i < 120; i++) {
  const result = await checkVadooVideoStatus(vid);
  statusCallback(result.status, i);
  if (result.status === 'completed') return result.url;
  if (result.status === 'failed') throw new Error('Video generation failed');
  await sleep(15000);
}
```

The poll UI (`renderVideoPolling`, `index.html:17423`) shows:

- Live status text: "Vadoo is generating… 4m elapsed."
- Cancel button (UI only — the Vadoo job continues server-side).
- Optional "Open in Vadoo dashboard" link.

## Cache

After completion, the result is cached as `video_<chapterId>` (chapter
mode) or `book_video_<bookId>_<chapterId>` (book modal). The cache row
holds `{ videoUrl, script, title, generatedAt }`.

## UI variants

### Chapter Video tab (`loadVideoContent`)

`index.html:17341`. The simple flow: button → poll → result card with
inline `<video>` player + download link.

### Book Video modal (`openBookVideoModal`)

`index.html:17522`. Lets the user generate a video for **multiple
chapters at once**. Each chapter's video is queued sequentially. Pre-flight
checks include the Vadoo balance.

### "Cached Video" card

`renderCachedVideoCard` (`index.html:17502`) shows previously generated
videos with a regenerate / delete control. Deleting wipes the IDB row.

## Limits and gotchas

- The Vadoo job can take 5–30 minutes. The polling UI keeps the user
  informed but the page must remain open (no background sync yet).
- The character limits per duration are precise — over-limit scripts
  are truncated at the last full sentence.
- Vadoo credits are pre-paid. The settings page shows the live credit
  count.
- The video URL is a direct Vadoo CDN link; if Vadoo rotates URLs, the
  cached link may eventually 404. (A robust rebuild would download and
  store the MP4 in OPFS.)

## Default settings

Saved in IDB:

```
vadooApiKey
vadooDuration   '30-60'
vadooVoice      'Onyx'
vadooStyle      'cinematic'
vadooTheme      'Hormozi_1'
vadooAspect     '9:16'
```

All synced via Drive.

Continue to [`15-image-generation.md`](15-image-generation.md).
