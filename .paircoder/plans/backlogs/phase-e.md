# Sprint E: TTS and Persistent Player — Browser / Lazybird / Google + Lockscreen

> One task per T-item in `docs/implementation-plan/phase-e-tts-and-player.md`.
> Three TTS providers, persistent mini-player, MediaSession on lockscreen, iOS recovery, batch generation, MP3 export.

### Phase 1: Browser TTS baseline + cleaning pipeline

### TE.1 -- Browser SpeechSynthesis player | Cx: 5 | P0

**Description:** Split chapter into sentences. Queue `SpeechSynthesisUtterance` per sentence. Track position via `boundary` events. Speeds: 0.75/1/1.25/1.5 via `utterance.rate`. Skip back/forward 10s via sentence index. Stop/resume preserves position. Works offline with zero config.

**AC:**
- [ ] Plays a chapter end-to-end with no API key
- [ ] Skip 10s lands on sensible sentence boundary
- [ ] Speed change applies mid-utterance
- [ ] Pause/resume preserves position across tab switches

**Depends on:** TA.7

### TE.2 -- TTS cleaning pipeline | Cx: 8 | P0

**Description:** `cleanTextForTTS(text, chapterId, describeTables, sequential, batch, modelOverride)`: pre-strip with regex helpers (markdown, citations), run `prompt_ttsClean` template, append table-description instruction when `describeTables`. Cache as `tts_cleaned_<chapterId>`. Per-chapter settings keys for `tts_clean_<provider>_<chapterId>`, `tts_describe_tables_...`, `tts_sequential_...`, `tts_model_...`.

**AC:**
- [ ] A/B listen: cleaned audio audibly removes citations
- [ ] Per-chapter toggle persists
- [ ] Cache by chapterId so second run is instant
- [ ] Table description toggle changes output (verified by snapshot)

**Depends on:** TB.1

### Phase 2: Cloud providers

### TE.3 -- Lazybird provider | Cx: 8 | P1

**Description:** `LAZYBIRD_API_BASE = 'https://api.lazybird.app/v1'`. Endpoints: `GET /status`, `GET /voices`, `POST /generate-speech`. Flow: cached `lazybird_audio_<chapterId>` → if missing: clean text → POST → blob → base64 → save row. Play via singleton `Audio` element (iOS-friendly). Voice picker UI: load all voices, group by language, gender badge, language filter.

**AC:**
- [ ] Audio caches; second play is instant
- [ ] Voice picker filters by language
- [ ] Singleton `Audio` prevents iOS multi-instance bugs
- [ ] Failure surfaces actionable error (e.g., 401 → "Check API key")

**Depends on:** TE.2, TA.2

### TE.4 -- Google Cloud TTS provider | Cx: 13 | P1

**Description:** Endpoints with `?key=`: `GET /v1/voices`, `POST /v1/text:synthesize`. Pricing table displayed per voice (Standard $4/M, WaveNet $16/M, Studio $160/M, Journey FREE preview). Voice picker: model + language filters, grouping, pricing badge. Long-text chunking: split at sentence boundaries respecting 5000-byte API limit; synthesize chunks; concatenate audio.

**AC:**
- [ ] Voices load with pricing badge
- [ ] 50k-word chapter chunks correctly (no chunk > 5000 bytes)
- [ ] Combined audio plays without glitches
- [ ] Cost estimate shown before bulk synthesis
- [ ] Failure surfaces actionable error

**Depends on:** TE.2

### Phase 3: Persistent player + lockscreen + iOS recovery

### TE.5 -- Persistent mini-player | Cx: 8 | P0

**Description:** Bottom-fixed bar: title (chapter), sub-title (book), progress bar (click-to-seek), buttons (prev-chapter sequential-only, skip-back, play/pause, skip-forward, next-chapter sequential-only, speed cycle, close). State: `persistentPlayerState`. `getActiveAudio()` resolves the right audio element by provider. `showPersistentPlayer(...)` paints state and calls `updateMediaSession()`.

**AC:**
- [ ] Player persists across library/book/chapter navigation
- [ ] Click-to-seek lands within 1s of target
- [ ] Close button stops + unmounts
- [ ] Player respects safe-area-inset on iOS notches

**Depends on:** TE.1, TE.3, TE.4

### TE.6 -- MediaSession integration | Cx: 5 | P0

**Description:** Set `navigator.mediaSession.metadata` (title, artist). Action handlers: `play`, `pause`, `seekbackward`, `seekforward`, `previoustrack`, `nexttrack`. Makes lockscreen + Bluetooth headphones work.

**AC:**
- [ ] Lockscreen play/pause works on iOS (manual)
- [ ] Lockscreen play/pause works on Android (manual)
- [ ] Bluetooth next-track skips chapter when in sequential mode
- [ ] Title/artist matches chapter/book

**Depends on:** TE.5

### TE.7 -- iOS recovery (visibility + pageshow) | Cx: 8 | P0

**Description:** Handle `document.visibilitychange` and `window.pageshow` (with `event.persisted`): re-sync `isPlaying` from `audio.paused`, re-register MediaSession. Handle `audio.onpause` / `audio.onplay` to keep UI in sync. Prevents play-button desync after backgrounding.

**AC:**
- [ ] Tab backgrounded 5min → foregrounded: UI is in sync; audio resumes (manual)
- [ ] Lockscreen pause → tab foregrounded: UI shows paused
- [ ] Vitest mocks visibility/pageshow and asserts recovery
- [ ] No double-trigger of MediaSession handlers

**Depends on:** TE.5, TE.6

### Phase 4: Sequential + batch + export

### TE.8 -- Sequential book playback | Cx: 8 | P1

**Description:** State: `sequentialPlaybackState` (isActive, bookId, chapterIds, currentIndex). `playAllBookAudio()`: sort chapters by index, find first with cached audio (or generate), play; on `ended`, advance. Show prev/next chapter buttons in persistent player.

**AC:**
- [ ] "Play All" advances chapters automatically
- [ ] Stop sequential resets the queue
- [ ] Prev/next chapter buttons only visible in sequential mode
- [ ] Lockscreen next-track advances chapter

**Depends on:** TE.5

### TE.9 -- Auto-advance (single chapter) | Cx: 3 | P1

**Description:** When NOT in sequential mode and chapter audio ends, auto-advance to next chapter if it has cached audio. If not, stop and notify.

**AC:**
- [ ] Auto-advance works when next chapter is cached
- [ ] Friendly notice when next chapter has no audio
- [ ] Doesn't fight with sequential mode

**Depends on:** TE.5

### TE.10 -- Batch audio generation modal | Cx: 8 | P1

**Description:** Modal: pick provider + voice + generate audio for all chapters sequentially. UI: per-chapter status (pending/generating/done/failed), live counter "5 / 23", minimize button (corner widget), cancel halts mid-flight. Skip already-cached chapters.

**AC:**
- [ ] 20-chapter book completes without OOM
- [ ] Cancel stops within 1 chapter
- [ ] Minimize collapses to a corner widget that's still cancelable
- [ ] Failed chapters retry-able individually

**Depends on:** TE.3, TE.4

### TE.11 -- Per-chapter MP3 export | Cx: 3 | P2

**Description:** `exportLazybirdAudio()` / `exportGoogleTtsAudio()`: decode cached base64 → Blob → object URL → download as `<chapterTitle>.mp3`.

**AC:**
- [ ] Downloaded file plays in VLC and QuickTime
- [ ] Filename sanitized for filesystem
- [ ] No memory spike on a 50MB chapter

**Depends on:** TE.3, TE.4

### TE.12 -- Combined book MP3 download | Cx: 5 | P2

**Description:** `downloadCombinedAudio()`: for each chapter in order, fetch cached base64, concatenate as single Blob (MP3 frames are concatenable). Download as `<bookTitle> - All Chapters.mp3`. Warn if combined > 500MB.

**AC:**
- [ ] Combined file plays end-to-end in VLC
- [ ] Warning above 500MB
- [ ] Documented limitation: different-bitrate chapters may glitch (FFmpeg.wasm fix in Sprint V)

**Depends on:** TE.11

### TE.13 -- Unified player (multi-source) | Cx: 5 | P2

**Description:** When both Lazybird and Google audio exist for a chapter: source dropdown to switch + single play button + progress bar delegating to chosen provider.

**AC:**
- [ ] Switch source preserves play position (best-effort)
- [ ] UI shows current source clearly
- [ ] No double-playback after switch

**Depends on:** TE.5

### TE.14 -- Settings additions (TTS) | Cx: 3 | P2

**Description:** `useLazybirdTts`, `lazybirdApiKey`, `lazybirdVoice`. `useGoogleTts`, `googleTtsApiKey`, `googleTtsVoice`. "Clear TTS Cache" button. "Refresh Voices" buttons.

**AC:**
- [ ] Keys persist in IDB (not localStorage)
- [ ] Clear cache wipes `tts_cleaned_*` and `*_audio_*` rows
- [ ] Refresh voices hits live endpoints
- [ ] Toggle to disable a provider hides its voice picker

**Depends on:** TA.8, TE.3, TE.4

---

## Sprint enforcement gates (must pass before Sprint F begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Manual** — Real-device test on iPad/iPhone: 5-min backgrounded resume works
- [ ] **G-Tests** — iOS recovery unit tests; MediaSession handler tests
- [ ] **G-Manual** — Cache key naming locked (`lazybird_audio_<id>`, `google_tts_audio_<id>`) — F's sync allowlist depends on it
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint F:**

- [ ] Confirm cache key naming
- [ ] Decide whether to sync audio via Drive (default yes; large but optional)
