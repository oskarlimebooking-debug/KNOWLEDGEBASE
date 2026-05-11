# Phase E — TTS and Persistent Player

> **Tagline:** Listen instead of read. Lockscreen controls included.

## Goal

Ship a complete audio listening experience with three TTS providers
(browser, Lazybird, Google Cloud TTS), a persistent mini-player that
survives navigation, and full integration with the OS lockscreen via
MediaSession.

## Why this phase / rationale

A meaningful share of users will *listen* to their library more than
read it. Audio also unlocks dead time: commute, dishes, gym. Doing TTS
right is harder than it looks because:

- iOS Safari aggressively suspends JS and breaks `audio.paused` sync.
- The browser TTS API is great until you want to seek.
- AI-cleaned text sounds dramatically better than raw OCR output, but
  that cleaning has to happen out-of-band so playback feels instant.

This phase is large but isolated. Once it ships, future phases can
treat audio as a solved primitive.

## Prerequisites

- Phase B (callAI for TTS cleaning).
- Phase A's persistent IDB.

## Deliverables

- 🎧 Listen mode tab.
- Browser SpeechSynthesis fallback (no API key required).
- Lazybird TTS provider with voice picker (language filter).
- Google Cloud TTS provider with voice picker (model + language filter
  + per-voice pricing display).
- Per-chapter TTS settings: AI cleaning, table description, sequential,
  model.
- TTS-cleaning pipeline (`cleanTextForTTS` + cache).
- Persistent mini-player with progress, speed, skip, close.
- MediaSession integration (lockscreen / Bluetooth controls).
- iOS visibility-change recovery.
- Sequential book playback ("Play All").
- Auto-advance to next chapter.
- Batch audio generation modal.
- Per-chapter MP3 export.
- Combined book download (single MP3 of all chapters concatenated).

## Task breakdown

### E1 — Browser SpeechSynthesis player

- Split chapter into sentences.
- Queue `SpeechSynthesisUtterance` per sentence.
- Track position via `boundary` events.
- Speed: 0.75 / 1 / 1.25 / 1.5 via `utterance.rate`.
- Skip back / forward 10 s by jumping to the appropriate sentence
  index.
- Stop / resume preserves position.
- This must work offline with zero configuration.

### E2 — TTS cleaning pipeline

- `cleanTextForTTS(text, chapterId, describeTables, sequential, batch,
  modelOverride)`:
  - Pre-strip with regex helpers (markdown, citations, et al.).
  - Run `prompt_ttsClean` template through callAI.
  - If `describeTables`, append a table-description instruction.
  - Cache result as `tts_cleaned_<chapterId>` row.
- Per-chapter settings keys (`tts_clean_<provider>_<chapterId>`,
  `tts_describe_tables_...`, `tts_sequential_...`, `tts_model_...`)
  are toggled inline in the player UI.

### E3 — Lazybird provider

`LAZYBIRD_API_BASE = 'https://api.lazybird.app/v1'`.

Endpoints used (all with `X-API-Key` header):
- `GET /status`
- `GET /voices`
- `POST /generate-speech` (`{ voiceId, text }` → audio Blob).

Flow:
1. Look up cached `lazybird_audio_<chapterId>`.
2. If missing: clean text (per chapter setting) → POST → blob → base64
   → save row.
3. Play via singleton `Audio` element (the iOS-friendly singleton
   pattern from `singlePlaybackAudioElement`).

Voice picker UI: load all voices, group by language, show gender
badge, optional language filter.

### E4 — Google Cloud TTS provider

Endpoints (key as `?key=` query param):
- `GET /v1/voices`
- `POST /v1/text:synthesize`

Pricing table for per-voice cost display:
```
Standard $4 / 1M (4M free)
WaveNet  $16 / 1M (1M free)
Neural2  $16 / 1M (1M free)
Polyglot $16 / 1M (1M free)
News     $16 / 1M (1M free)
Casual   $16 / 1M (1M free)
Chirp-HD $30 / 1M (1M free)
Chirp3-HD $30 / 1M (1M free)
Studio   $160 / 1M (100k free)
Journey  FREE (preview, 30 req/min)
```

Voice picker UI: model + language filters, voice grouped by model
type, pricing badge per option.

Long-text chunking: split at sentence boundaries respecting the 5000-
byte API limit, synthesize each chunk, concatenate the resulting
audio. (Imperfect but works in practice for MP3.)

### E5 — Persistent mini-player

A bottom-anchored bar (`position: fixed`):
- Title (chapter), sub-title (book).
- Progress bar (click-to-seek).
- Buttons: prev-chapter (sequential only), skip-back, play/pause,
  skip-forward, next-chapter (sequential only), speed cycle, close.

State:
```js
let persistentPlayerState = {
  isActive, chapterId, chapterTitle, bookTitle, bookId,
  provider // 'lazybird' | 'google' | 'browser'
};
```

`getActiveAudio()` resolves the right audio element by provider.

`showPersistentPlayer(...)` paints state, calls `updateMediaSession()`.

### E6 — MediaSession integration

```js
navigator.mediaSession.metadata = new MediaMetadata({ title, artist });
navigator.mediaSession.setActionHandler('play',          ...);
navigator.mediaSession.setActionHandler('pause',         ...);
navigator.mediaSession.setActionHandler('seekbackward',  ...);
navigator.mediaSession.setActionHandler('seekforward',   ...);
navigator.mediaSession.setActionHandler('previoustrack', ...);
navigator.mediaSession.setActionHandler('nexttrack',     ...);
```

This makes the lockscreen + Bluetooth headphones work.

### E7 — iOS recovery

Handle these events:
- `document.visibilitychange` → re-sync `isPlaying` from
  `audio.paused`, re-register MediaSession.
- `window.pageshow` (with `event.persisted`) → same recovery.
- `audio.onpause` / `audio.onplay` → keep UI in sync when audio is
  paused externally.

This is the iOS-specific code that prevents the play button from
desyncing after backgrounding the tab.

### E8 — Sequential book playback

State:
```js
let sequentialPlaybackState = {
  isActive, bookId, chapterIds: [...], currentIndex
};
```

`playAllBookAudio()`:
1. Sort chapters by `index`.
2. Find first chapter with cached audio (or generate).
3. Play; on `ended`, advance to next.
4. Show prev/next chapter buttons in the persistent player.

`stopSequentialPlayback()` resets the queue.

### E9 — Auto-advance (single chapter)

When the user is *not* in sequential mode and a chapter audio ends,
auto-advance to the next chapter in the same book if it has cached
audio. If it doesn't, stop and notify.

### E10 — Batch audio generation

Modal where the user picks provider + voice and generates audio for
all chapters in the current book sequentially.

UI:
- Per-chapter status (pending / generating / done / failed).
- Live counter "5 / 23".
- Minimize button (collapses to a corner widget).
- Cancel halts the queue mid-flight.

Skip already-cached chapters.

### E11 — Per-chapter MP3 export

`exportLazybirdAudio()` / `exportGoogleTtsAudio()`:
- Decode cached base64 → Blob → object URL.
- Trigger download as `<chapterTitle>.mp3`.

### E12 — Combined book download

`downloadCombinedAudio()`:
- For each chapter in order, fetch cached base64 audio.
- Concatenate as a single Blob (MP3 frames are concatenable).
- Trigger download as `<bookTitle> - All Chapters.mp3`.

Warn if the combined size exceeds 500 MB.

### E13 — Unified player (when both providers have cached audio)

If both Lazybird and Google audio exist for a chapter, show:
- Source dropdown to switch.
- Single play button + progress bar that delegates to the chosen
  provider's element.

### E14 — Settings additions

- `useLazybirdTts`, `lazybirdApiKey`, `lazybirdVoice`.
- `useGoogleTts`, `googleTtsApiKey`, `googleTtsVoice`.
- "Clear TTS Cache" button (wipes all `tts_cleaned_*` rows).
- "Refresh Voices" buttons for both providers.

## Acceptance criteria

- [ ] Browser TTS works on a fresh device with no API keys.
- [ ] Lazybird audio generates, caches, and plays.
- [ ] Google TTS generates, caches, and plays.
- [ ] Lockscreen play/pause works on iOS and Android.
- [ ] Tab backgrounded for 5 minutes, foregrounded — UI state is
      correct and audio resumes seamlessly.
- [ ] "Play All Book" advances through chapters automatically.
- [ ] Batch audio generation completes a 20-chapter book without OOM.
- [ ] Combined MP3 download produces a playable file.
- [ ] TTS cleaning removes citations and produces noticeably cleaner
      audio (manual A/B listen).
- [ ] All speed presets (0.75x / 1x / 1.25x / 1.5x) work.

## Effort estimate

- **T-shirt:** L
- **Person-weeks:** 4–5
- **Critical path:** iOS audio recovery + MediaSession.

## Risks & unknowns

- **iOS Safari audio quirks** are the biggest risk. Test on a real
  device early. Known gotchas:
  - First-play must be inside a synchronous user gesture.
  - `Audio` element must be created in a user gesture for autoplay.
  - Backgrounded tabs lose state; recovery code is mandatory.
- **Google TTS cost** can spike for users who batch-process a textbook
  with Studio voices ($160/M chars). Show running cost estimate in
  the batch modal.
- **MP3 concatenation** is technically incorrect (different bitrates /
  encoders produce broken streams). 99% of TTS output uses the same
  encoder; if a user reports a broken combined file, document the
  limitation. Phase P offers a real fix via FFmpeg.wasm.

## Out of scope

- Whisper word-by-word timing (Phase P).
- Local Kokoro / Piper TTS (Phase P).
- Crossfade between chapters (Phase P).
- ElevenLabs as a provider (Phase R).
- Per-section voice selection (Phase P).

## Decision points before Phase F

- [ ] Confirm cache key naming (`lazybird_audio_<id>`,
      `google_tts_audio_<id>`). Phase F's sync allowlist depends on
      these.
- [ ] Decide whether to sync audio cache via Drive (recommended yes:
      large but optional) or keep audio device-local.

---

Continue to [Phase F — Cloud Sync](phase-f-cloud-sync.md).
