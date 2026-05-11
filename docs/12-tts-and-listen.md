# 12 — TTS and the Listen Mode

The Listen tab supports three TTS providers, the Generate-All-Audio batch
flow, and a Play-All-Book sequential flow.

## Providers

| Provider | API | Quality | Cost | Storage |
|----------|-----|---------|------|---------|
| Browser SpeechSynthesis | `window.speechSynthesis` | Mediocre | Free | None (live synthesis) |
| Lazybird AI | `https://api.lazybird.app/v1` | Excellent | Paid (per usage) | Audio Blob in IDB as base64 |
| Google Cloud TTS | `https://texttospeech.googleapis.com/v1` | Very good (esp. Studio/Chirp-HD) | Paid | Audio in IDB |

The user picks one in Settings; if both Lazybird and Google TTS have
cached audio for a chapter, a Source dropdown appears.

## Listen mode UI (`loadListenContent`)

`index.html:14342`. Branches:

```
if cached audio exists for either Lazybird or Google:
  show unified player with provider selector
else if useLazybirdTts:
  show Lazybird player UI
else if useGoogleTts:
  show Google TTS player UI
else:
  show browser SpeechSynthesis UI
```

### Per-chapter TTS settings

For each provider × chapter, three independent toggles persist:

- `tts_clean_<provider>_<chapterId>` — run AI cleaning before TTS
- `tts_describe_tables_<provider>_<chapterId>` — convert tables to prose
- `tts_sequential_<provider>_<chapterId>` — chunk for very long chapters
- `tts_model_<provider>_<chapterId>` — Gemini model used for cleaning

These are all surfaced as checkboxes in the player UI.

## Browser SpeechSynthesis path

Functions: `toggleSpeech`, `startSpeech`, `stopSpeech`, `speakFromPosition`,
`updatePlayButton`, `updateAudioProgress`, `setSpeed`, `skipBack`,
`skipForward`, `seekAudio` (`index.html:18814–19282`).

- Splits text into sentences, queues each into a `SpeechSynthesisUtterance`.
- Tracks position via `boundary` events for seek/skip.
- `setSpeed(rate)` updates `utterance.rate`.
- Doesn't survive navigation (the API is page-scoped).

## Lazybird path

Constants:
```js
const LAZYBIRD_API_BASE = 'https://api.lazybird.app/v1';
```

### Endpoints used

- `GET /status` — health check (`checkLazybirdStatus`)
- `GET /voices` — list voices (`fetchLazybirdVoices`)
- `POST /generate-speech` — generate audio (`generateLazybirdSpeech`)

Auth header: `X-API-Key: <user's Lazybird key>`.

### Flow

1. `toggleLazybirdSpeech` — toggles play/pause with iOS-friendly
   user-gesture preservation. Pre-creates a singleton `Audio` element on
   first user gesture so iOS unlocks playback.
2. `startLazybirdSpeech` — checks cache (`lazybird_audio_<chapterId>`); if
   missing, builds the speech text:

   ```
   chapter.content
     → strip HTML tags
     → decode entities
     → stripMarkdownForTTS()
     → if `tts_clean_lazybird_<id>`: cleanTextForTTS()
   ```

3. POST to `/generate-speech` with `{voiceId, text}`, receives audio
   blob.
4. Convert blob to base64 via FileReader, store in IDB `generated` row:

   ```js
   {
     id: `lazybird_audio_<chapterId>`,
     chapterId, type: 'lazybird_audio',
     audioData: 'data:audio/mpeg;base64,...',
     voiceId,
     generatedAt: ISO
   }
   ```

5. Play via `playLazybirdAudioFromCache(base64)` which sets `audio.src` to
   the data URL.

### Voice picker

`refreshLazybirdVoices()` populates a dropdown grouped by language, with
gender suffix. A language filter narrows the list.

## Google Cloud TTS path

### Pricing table

```js
const GOOGLE_TTS_PRICING = {
  Standard:  { price: 4.00,  freeTier: 4_000_000 },
  WaveNet:   { price: 16.00, freeTier: 1_000_000 },
  Neural2:   { price: 16.00, freeTier: 1_000_000 },
  Polyglot:  { price: 16.00, freeTier: 1_000_000 },
  News:      { price: 16.00, freeTier: 1_000_000 },
  Casual:    { price: 16.00, freeTier: 1_000_000 },
  'Chirp-HD':  { price: 30.00, freeTier: 1_000_000 },
  'Chirp3-HD': { price: 30.00, freeTier: 1_000_000 },
  Studio:    { price: 160.00, freeTier: 100_000 },
  Journey:   { price: 0,      freeTier: Infinity, note: 'Preview (30 req/min)' }
};
```

`getVoiceModelType(voiceName)` returns the bucket from the voice's
internal name pattern. The settings UI displays cost per million chars +
free tier per voice family.

### Endpoints

- `GET /v1/voices` — list voices (`fetchGoogleTtsVoices`)
- `POST /v1/text:synthesize` — generate (`generateGoogleTtsSpeech`)

Both use API key as URL param: `?key=<apiKey>`.

### Long-text chunking

`splitTextIntoChunks(text, maxLength)` (`index.html:22029`) splits at
sentence boundaries respecting the 5 000-byte limit, then synthesizes
each chunk and concatenates the resulting MP3s. `MediaSource`-style
splicing isn't used; chunks are decoded as base64 then re-encoded into a
single Blob.

### Storage

Cached as `google_tts_audio_<chapterId>`.

## Unified player

When both providers have cached audio, `loadListenContent` shows the
unified UI:

- Source dropdown (`switchAudioSource(provider)`).
- One play button (`toggleUnifiedSpeech`), one progress bar
  (`seekUnifiedAudio`), one speed selector.
- The actual audio element is delegated to the chosen provider's audio
  variable (`googleTtsAudio` or `lazybirdAudio`).
- Speed: 0.75x / 1x / 1.25x / 1.5x via `audio.playbackRate`.

`initializeUnifiedPlayer(provider)` (`index.html:22360`) wires the right
event handlers.

## Batch audio generation (`openBatchAudioModal`)

`index.html:19783`. Modal where the user chooses provider + voice, hits
Start, and the app generates audio for **all chapters** sequentially.

Progress UI:
- Per-chapter status: pending / generating / done / failed.
- Live counter "5 / 23".
- Minimize button stays in the corner.
- Cancel halts the queue mid-flight.

Cached audio is reused; only missing chapters are processed.

## Sequential book playback (Play All)

`playAllBookAudio()` (`index.html:20710`) and
`playAllBookAudioDirect()` (`index.html:20706`).

Behavior:
1. Fetch all chapters, sort by `index`.
2. Find the first chapter that has cached audio.
3. Queue each chapter's audio in order.
4. On `audio.ended`, advance to the next chapter; missing audio is
   on-demand generated (with a short loading indicator).

`sequentialPlaybackState`:
```js
{
  isActive: bool,
  bookId,
  chapterIds: [...],
  currentIndex: int
}
```

The persistent player shows ⏮ ⏭ chapter buttons whenever
`sequentialPlaybackState.isActive`.

## Combined download (`downloadCombinedAudio`)

`index.html:20628`. Concatenates all cached chapter audio for a book into
a single MP3 file and triggers a download. Uses `Blob` concat — no
re-encoding (MP3 frames are concatenable; this is fragile but works in
practice).

## Export single chapter (`exportLazybirdAudio`, `exportGoogleTtsAudio`)

Decodes the cached base64 to a Blob, creates an object URL, triggers a
download as `<chapterTitle>.mp3`.

## Cache invalidation

- `regenerateLazybirdAudio` and `regenerateGoogleTtsAudio` delete the
  cache row and start fresh.
- `clearTTSCache` (settings) wipes all `tts_cleaned_*` rows.

Continue to [`13-audio-player.md`](13-audio-player.md).
