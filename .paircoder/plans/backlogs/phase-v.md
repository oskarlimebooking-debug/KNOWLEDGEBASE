# Sprint V: Audio Plus — Whisper karaoke + Kokoro/Piper local TTS + crossfade + SSML

> One task per T-item in `docs/implementation-plan/phase-v-audio-plus.md` (P1–P12 in source doc).
> Word-by-word highlighting, fully local TTS, crossfade, pitch-preserving speed, SSML, audiobook import.

### Phase 1: Whisper + karaoke

### TV.1 -- Whisper integration | Cx: 13 | P0

**Description:** Whisper.cpp WASM in a Web Worker. Transcribe TTS-cleaned audio to word-timed transcript.

**AC:**
- [ ] Transcribes 10-min audio in < 60s on M1 / Pixel 7
- [ ] Word timestamps within ±200ms
- [ ] Falls back gracefully on unsupported devices

**Depends on:** TG.7, TE.2

### TV.2 -- Karaoke highlighting | Cx: 8 | P1

**Description:** Sync transcript word-by-word with audio playback. Highlight current word + auto-scroll.

**AC:**
- [ ] Highlight syncs within ±300ms
- [ ] Auto-scroll keeps current word visible
- [ ] Disable toggle in settings
- [ ] Works at 1x and 1.5x speeds

**Depends on:** TV.1

### Phase 2: Local TTS

### TV.3 -- Local TTS via Kokoro | Cx: 13 | P1

**Description:** Kokoro TTS via ONNX runtime in Web Worker. Voices bundled or downloadable.

**AC:**
- [ ] At least 3 voices working
- [ ] Quality acceptable on A/B test vs Google Neural2
- [ ] No network call after voice load

**Depends on:** TG.7

### TV.4 -- Local TTS via Piper | Cx: 8 | P2

**Description:** Piper TTS alternative.

**AC:**
- [ ] Compatible voices download
- [ ] Quality acceptable
- [ ] Both Kokoro + Piper coexist; user picks default

**Depends on:** TV.3

### Phase 3: Polish

### TV.5 -- Crossfade between chapters | Cx: 5 | P2

**Description:** When sequential playback advances chapter, crossfade outgoing/incoming audio 500ms.

**AC:**
- [ ] No audio gap
- [ ] User can disable
- [ ] Mobile-friendly

**Depends on:** TE.8

### TV.6 -- Pitch-preserving variable speed | Cx: 8 | P1

**Description:** Use Web Audio API + RubberBand WASM (or `playbackRate` with `preservesPitch: true` where supported).

**AC:**
- [ ] Speed 0.5–2.5x without pitch distortion
- [ ] CPU overhead acceptable on mid-tier mobile
- [ ] Vitest covers tone-preserving expectations

**Depends on:** TE.5

### TV.7 -- SSML support | Cx: 8 | P1

**Description:** Parse SSML tags in cleaned text → drive emphasis, pauses, pronunciation in supported providers.

**AC:**
- [ ] Google TTS SSML parity
- [ ] Lazybird ignores unknown tags gracefully
- [ ] Schema documented

**Depends on:** TE.2

### TV.8 -- Resume from last position | Cx: 3 | P0

**Description:** Persist play position per chapter; resume on next open.

**AC:**
- [ ] Survives reload
- [ ] Per-chapter precision
- [ ] Drive sync via settings whitelist

**Depends on:** TE.5

### Phase 4: Audiobook import + per-section voice + background

### TV.9 -- Audiobook import (Whisper transcription) | Cx: 13 | P2

**Description:** Import MP3 audiobook → Whisper transcribes → creates Source with `kind: 'book'` and pre-generated audio.

**AC:**
- [ ] 5-hour audiobook transcribes overnight
- [ ] Chapter boundaries detected by silence gaps
- [ ] User can edit boundaries post-import

**Depends on:** TV.1, TM.6

### TV.10 -- Per-section voice selection | Cx: 5 | P2

**Description:** Different voices for different sections (e.g., quotes in different voice).

**AC:**
- [ ] Schema for per-section voice
- [ ] UI: drag voice tags onto text
- [ ] Persists in IDB

**Depends on:** TV.3

### TV.11 -- Background generation queue | Cx: 8 | P1

**Description:** TTS generation runs in Web Worker; Service Worker keeps it alive when tab is backgrounded (where supported).

**AC:**
- [ ] Background queue continues with tab hidden
- [ ] Notification on completion (opt-in)
- [ ] Cancellable

**Depends on:** TE.10

### TV.12 -- Persistent player extensions | Cx: 3 | P2

**Description:** Add karaoke toggle, speed picker, SSML status to mini-player.

**AC:**
- [ ] All 3 controls present
- [ ] Persist per session
- [ ] Mobile-friendly

**Depends on:** TE.5, TV.2

---

## Sprint enforcement gates (must pass before Sprint W begins)

- [ ] **G-AC** — all task AC ticked
- [ ] **G-Manual** — Real-device test: 30-min audiobook with karaoke on iPad
- [ ] **G-Tests** — Whisper timing accuracy verified on 3 fixtures
- [ ] **G-State** — `state.md` updated

**Decision points before Sprint W:**

- [ ] Default local TTS (Kokoro vs Piper)
- [ ] Whisper model size: tiny/base/small (quality vs speed tradeoff)
