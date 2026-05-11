# 15 — Image Generation

The app generates images for two purposes:

1. **Feed post images** — when a feed post has `hasImage: true`.
2. **AI book covers** — alternative to PDF-page-1 thumbnails.

Two providers are supported:

| Provider | Function | Auth |
|----------|----------|------|
| Google Gemini | `generateFeedImage` (`index.html:12604`) | User's Gemini API key |
| Bonkers (via Merlin) | `generateBonkersImage` (`index.html:12507`) | User's Merlin token |

## Provider switching

`getSetting('imageProvider')` returns `'gemini'` or `'bonkers'`. The
setting UI shows a different config block per provider via
`toggleImageProviderSettings()` (`index.html:12501`).

## Gemini image-out

Gemini natively returns images for certain models (Imagen-style). The app
auto-detects which Gemini models support image generation:

`fetchImageCapableModels(apiKey)` (`index.html:12424`):

1. Calls `GET /v1beta/models?key=<apiKey>`.
2. Iterates models. For each, attempts a tiny generate call with
   `responseMimeType: 'image/jpeg'` to see if it doesn't error.
3. Caches the result list and exposes via `loadImageModelOptions`.

Generation: `callGeminiAPI(prompt, apiKey, model, { responseMimeType: 'image/jpeg' })`.
The response has `data.candidates[0].content.parts[0].inlineData.data`
which is the base64 JPEG.

## Bonkers via Merlin

Bonkers is a Stable-Diffusion-style model exposed inside Merlin. Endpoint:

```
POST https://www.getmerlin.in/arcane/api/v1/wallflower/unified-generation
```

Auth: `Authorization: Bearer <merlinIdToken>` (refreshed via
`getMerlinToken`).

Body:

```jsonc
{
  "prompt": "<imagePrompt>",
  "model": "bonkers-advance" | "bonkers-quality" | ...,
  "size": "1024x1024" | "1024x1792" | "1792x1024",
  "n": 1
}
```

Response: `{ urls: ["https://merlin.cdn/..."] }`. The URL is fetched and
inlined as base64 (so it's stored locally and survives Merlin URL
rotation).

## `generateFeedImage` flow

`index.html:12604`:

```
1. Resolve provider from settings.
2. Build a tuned prompt from the personality:
   - Professor: "Clean infographic, scientific illustration, textbook style"
   - Hype: "Bold motivational poster, neon, dramatic lighting"
   - Contrarian: "Subversive art, ironic imagery, punk aesthetic"
   - Unhinged: "Surreal, absurdist, meme-style, chaotic collage"
   - Nurturing: "Soft watercolor, warm cozy illustration, gentle pastels"
   - Storyteller: "Cinematic scene, storybook illustration"
   - Meme: "Internet meme aesthetic, reaction image style"
3. Call the chosen provider with the merged prompt.
4. Return base64 data URL.
5. Store back into the cached feed JSON under posts[i].imageUrl.
```

## Cover regeneration

`regenerateCoverImage()` (`index.html:13960`) lets the user pick:

- "Reset to PDF page 1" → re-renders `generateCoverImage(pdfData)`.
- "Reset to emoji" → uses `getBookEmoji(title)` to pick a stylized cover.
- "Generate AI cover" → `generateAICover()` (`index.html:13990`) sends a
  prompt like `"Book cover for '${title}' by ${author}. Style:
  contemporary nonfiction. No text on the cover."` to the chosen provider
  and stores the result in `book.coverImage`.

## Aspect ratios

Feed images: portrait `1024x1792` (matches social-media aesthetics).
Book covers: portrait `1024x1792`.

## Failure modes

- If `imagePrompt` is empty, the placeholder remains.
- If the provider returns an error (rate limit, no quota), a toast is
  shown and the placeholder reverts to the prompt text.
- For Bonkers, if Merlin's auth has expired, `getMerlinToken()`
  auto-refreshes via the Firebase refresh-token flow.

## Future: more providers

A rebuild would expose a provider plugin interface. Candidates:

- **OpenAI DALL·E** via the user's own OpenAI key.
- **Midjourney** via their REST API (newer beta).
- **Replicate** for any open-weight image model.
- **Local Stable Diffusion** via WebGPU.

See [`24-future-development.md`](24-future-development.md).

Continue to [`16-ai-providers.md`](16-ai-providers.md).
