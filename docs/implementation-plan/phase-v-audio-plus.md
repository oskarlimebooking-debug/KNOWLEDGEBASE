# Phase P — Audio Plus

> **Tagline:** Word-by-word highlighting, local TTS, crossfade, SSML.

## Goal

Take the audio experience from "good" (Phase E) to "best in class":
- Sync transcript with audio for word-by-word highlighting.
- Run a fully local TTS engine for offline + privacy.
- Crossfade between chapters.
- Pitch-preserving variable speed.
- SSML support for emphasis / pauses / pronunciation.
- Resume from last position across sessions.
- Audiobook MP3 import via Whisper transcription.

## Why this phase / rationale

Audio is the most-used feature for many users. The Phase E
implementation is solid but has gaps:
- Speed change distorts pitch on browser TTS.
- No way to follow-along while listening.
- Loss of internet = no Lazybird / Google audio.
- No visual sync between audio and text.

Closing these gaps takes the experience from "decent listening" to
"premium audiobook + study tool". Each feature is independently
valuable; together they elevate the whole.

## Prerequisites

- Phase E (TTS infrastructure, persistent player).
- Phase M (worker infrastructure).
- Phase O (sync for audio cache).

## Deliverables

- Whisper-based per-word timestamps for any cached audio.
- Word-by-word highlighting during playback (karaoke-style).
- Local TTS via Kokoro / Piper WASM (offline-capable).
- Tesseract WASM as a fallback OCR engine (covered in Phase I but
  productized here).
- Crossfade between chapter audio.
- WSOLA pitch-preserving variable playback speed (Web Audio API).
- SSML pass-through for providers that support it.
- Position memory for audio (resume from last second).
- Audiobook import: drop an MP3 → transcribe → split into chapters.
- Per-section voice selection (dialogue vs narration).
- Background generation queue (pre-generate next 3 chapters).

## Task breakdown

### P1 — Whisper integration

Use [`@xenova/transformers`](https://huggingface.co/docs/transformers.js)
or `whisper.cpp` WASM in a worker.

```ts
// src/workers/whisper.worker.ts
import { pipeline } from '@xenova/transformers';
const transcriber = await pipeline('automatic-speech-recognition',
                                   'Xenova/whisper-tiny.en');

export const api = {
  async transcribe(audio: ArrayBuffer): Promise<{
    text: string;
    chunks: { text: string; timestamp: [number, number] }[];
  }> {
    return transcriber(audio, { return_timestamps: 'word' });
  }
};
```

Run on cached audio after generation. Store results as
`audio_words_<chapterId>` in the `generated` store.

### P2 — Karaoke highlighting

Player UI extension:
- The chapter content is rendered as `<span data-word-idx>` per word.
- During playback, tick-tick the `data-word-idx` attribute that
  matches the current `audio.currentTime` against the timestamp map.
- The active word gets `class="word-active"` (highlight background).
- Auto-scroll to keep the active word in view.

Toggle in the player UI: "Karaoke mode".

### P3 — Local TTS via Kokoro

[Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) is an 82M-parameter
TTS model that runs in WASM at near-real-time.

```ts
import { KokoroTTS } from 'kokoro-tts-web';

const tts = new KokoroTTS('/models/kokoro-82m.onnx');
const audio = await tts.synthesize('Hello, world.', { voice: 'af_bella' });
```

Add as a TTS provider plugin. Lazy-load the model (~80 MB) on first
use.

Same plugin contract as Lazybird / Google. Output: a `Blob` ready for
the unified player.

### P4 — Local TTS via Piper

Alternative to Kokoro for users who prefer Piper:
[piper.wasm](https://github.com/rhasspy/piper).

Smaller voices (~30 MB each) but more variants per voice.

Both providers are listed in the TTS dropdown with a "(local)" badge.

### P5 — Crossfade between chapters

In sequential playback (Phase E):
- 500ms before a chapter ends, start fading out the current audio.
- Simultaneously fade in the next chapter's audio.
- Use Web Audio API's `GainNode` for smooth ramps:
  ```js
  const gain = audioCtx.createGain();
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
  ```

### P6 — Pitch-preserving variable speed

Browser TTS doesn't preserve pitch when changing rate. For cached
audio (Lazybird / Google / local):

Use SoundTouch.js (WSOLA implementation) in a Web Audio worklet:
```ts
const node = audioCtx.audioWorklet.addModule('/soundtouch-worklet.js');
const sourceNode = audioCtx.createBufferSource();
const stretchNode = new AudioWorkletNode(audioCtx, 'soundtouch-processor');
stretchNode.parameters.get('tempo').value = 1.5;  // 1.5x speed, same pitch
sourceNode.connect(stretchNode).connect(audioCtx.destination);
```

Toggle in settings: "Preserve pitch when changing speed".

### P7 — SSML support

For providers that accept SSML (Google TTS, Lazybird if supported),
allow the user to author chapter content in SSML for fine control:

```xml
<speak>
  Hello, <emphasis level="strong">world</emphasis>.
  <break time="500ms"/>
  This is <prosody rate="slow">slow</prosody>.
</speak>
```

Add a "Use SSML" toggle in the TTS cleaning options. The TTS-cleaning
prompt has an SSML mode that emits SSML instead of plain text.

### P8 — Resume from last position

`audio_position_<chapterId>` setting key persisted on every
`timeupdate` (throttled).

On chapter open:
- Show "Resume from 3:42?" button if the position is more than 5
  seconds in.

### P9 — Audiobook import

Drop an MP3 → transcribe via Whisper → run chapter detection on the
transcript.

UI:
- New import option: "Audiobook MP3".
- After transcription, the user can choose to align timestamps to
  chapter boundaries (so each chapter has its own audio segment).
- Audio segments stored in the chapter cache.

### P10 — Per-section voice selection

Some books have heavy dialogue. Detect dialogue vs narration via:
- Quoted strings = dialogue.
- AI tagging via a sequential pass.

Tag chunks with `voice: 'narrator' | 'character-1' | ...` and let
the user assign voices per role.

This is a deep feature — recommend opt-in via a toggle.

### P11 — Background generation queue

When the user opens a chapter, pre-generate audio for the next 3
chapters in the background (using the configured TTS provider).

Queue:
- Idle-time only (request-idle-callback).
- Max 1 concurrent generation.
- Cancellable on chapter switch.
- User can disable: "Pre-generate next chapters" setting.

### P12 — Persistent player extensions

- Karaoke toggle.
- Crossfade toggle.
- Pitch-preserve toggle.
- Sleep timer (stop after N minutes).
- Audio chapter scrubber (drag through the entire book's audio
  timeline, not just the current chapter).

## Acceptance criteria

- [ ] Karaoke mode highlights the spoken word in real-time.
- [ ] Local TTS produces audio offline (airplane-mode test).
- [ ] Crossfade is audible and not jarring.
- [ ] Pitch-preserve at 1.5x sounds natural (not chipmunked).
- [ ] SSML markup affects pronunciation correctly.
- [ ] Resume from last position works across reloads.
- [ ] An audiobook MP3 imports as a multi-chapter book with synced
      audio segments.
- [ ] Background generation doesn't slow the foreground UI.

## Effort estimate

- **T-shirt:** L
- **Person-weeks:** 4–6
- **Critical path:** Whisper integration + karaoke timing accuracy.

## Risks & unknowns

- **Whisper accuracy** — `tiny.en` is fast but error-prone on dense
  academic content. Offer a `base.en` upgrade (~145 MB).
- **Local TTS quality** — Kokoro is good for English but limited
  language coverage.
- **Model download UX** — first-time users see an 80 MB download.
  Show clear progress.
- **WSOLA quality** — at extreme tempos (>2x or <0.5x) artifacts
  emerge. Limit range.
- **Battery usage** — Whisper + WSOLA are CPU-heavy. Don't run them
  on battery saver.

## Out of scope

- Multi-voice dialogue with character-distinct voices for every
  speaker (Phase R — needs a much heavier engine).
- Music / SFX layered into TTS (Phase R).
- Real-time voice cloning (Phase R).

## Decision points before Phase Q

- [ ] Confirm Whisper model size default (`tiny.en` vs `base.en`).
- [ ] Decide whether local TTS is opt-in or shown alongside cloud
      providers in the Listen UI.

---

Continue to [Phase Q — Knowledge Plus](phase-q-knowledge-plus.md).
