# 13 — Persistent Audio Player

The persistent mini-player is the bottom-anchored, always-visible bar that
appears whenever there is active audio. It survives navigation between
views, integrates with the OS lockscreen via `MediaSession`, and handles
iOS-specific quirks (tab suspension, audio.paused desync).

## Markup

In `index.html:4958`. Hidden by default; `visible` class shows it. Fields:

- Title (chapter name)
- Sub-title (book name)
- Buttons: prev-chapter (sequential only) / skip-back / play / skip-forward /
  next-chapter (sequential only) / speed-cycle / close
- Progress bar (uniform, click-to-seek)

## State

```js
let persistentPlayerState = {
  isActive: false,
  chapterId: null,
  chapterTitle: '',
  bookTitle: '',
  bookId: null,
  provider: null    // 'lazybird' | 'google'
};
```

Plus the global `lazybirdAudio` and `googleTtsAudio` HTMLAudioElement
references, and `singlePlaybackAudioElement` (a singleton pre-created on
the first user gesture for iOS unlock).

## API

- `showPersistentPlayer(chapterId, chapterTitle, bookTitle, bookId)` —
  sets state, paints UI, calls `updateMediaSession()`.
- `hidePersistentPlayer()` — toggles visibility off.
- `getActiveAudio()` — resolves provider via `persistentPlayerState.provider`,
  falls back to whichever audio is non-paused.
- `togglePersistentPlayback()` — pause / play; uses `audio.paused` directly
  (not the `isPlaying` flag) to avoid iOS desync.
- `persistentSkipBack(10)` / `persistentSkipForward(10)` — adjust
  `currentTime`.
- `persistentPrevChapter()` / `persistentNextChapter()` — only useful in
  sequential mode; advances `sequentialPlaybackState.currentIndex` and
  loads the next chapter's audio.
- `cyclePersistentSpeed()` — 1x → 1.25x → 1.5x → 0.75x → 1x.
- `closePersistentPlayer()` — pause audio, hide bar.

## MediaSession integration

`updateMediaSession()` (`index.html:20245`):

```js
navigator.mediaSession.metadata = new MediaMetadata({
  title: chapterTitle,
  artist: bookTitle
});
navigator.mediaSession.setActionHandler('play',  () => …);
navigator.mediaSession.setActionHandler('pause', () => …);
navigator.mediaSession.setActionHandler('seekbackward',  persistentSkipBack);
navigator.mediaSession.setActionHandler('seekforward',   persistentSkipForward);
navigator.mediaSession.setActionHandler('previoustrack', persistentPrevChapter);
navigator.mediaSession.setActionHandler('nexttrack',     persistentNextChapter);
```

This makes the lockscreen / Bluetooth headphone controls actually work.

## iOS recovery code paths

iOS Safari aggressively suspends JS execution when the tab backgrounds.
This causes:

1. `isPlaying` flag desync from real `audio.paused`.
2. MediaSession action handlers may be dropped after long suspensions.
3. `audio.currentTime` may freeze briefly.

The app handles these via:

### `visibilitychange` listener (`index.html:20292`)

When the tab returns to visible:

```js
isPlaying = !activeAudio.audio.paused;
updatePersistentPlayerUI();
updateLazybirdPlayerUI(isPlaying ? 'playing' : 'paused')
  // or update Google TTS UI
updateMediaSession();   // re-register handlers
navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
```

### `pageshow` listener (`index.html:20320`)

Fires when iOS uses the back-forward cache. Re-syncs state similarly.

### `audio.onpause` / `audio.onplay` listeners

Set up in `playLazybirdAudioFromCache` and the equivalent Google function.
These fire when audio is paused/played from outside the app (Siri, phone
call, control center) and keep the UI in sync.

## Auto-advance

When a chapter audio ends and not in sequential mode,
`autoAdvanceToNextChapter()` (`index.html:20974`) fetches the next chapter
in the same book by index and starts its audio (cached or freshly
generated).

If sequential mode is active, the existing
`sequentialPlaybackState.currentIndex` is incremented by
`playNextChapterInSequence()`.

## Sequential audio play helpers

- `getOrCreateSequentialAudio()` — returns a singleton audio element
  reserved for sequential playback.
- `playGoogleTtsAudioSequential(base64)` and
  `playLazybirdAudioSequential(base64)` — share progress / time-update
  / ended handlers across the whole book without re-creating elements.
- `stopSequentialPlayback()` — pauses the audio and resets the queue.

## "Stop and close" semantics

`closePersistentPlayer()` *pauses* the audio and hides the bar. It does
not delete the cached audio. The user can re-open Listen mode and resume
from the same position.

## Why two audio elements? (single + sequential)

iOS has a 1-element-per-page audio playback budget on older Safari
versions. The single (`singlePlaybackAudioElement`) is reused across
provider transitions to keep the user-gesture unlock alive. The sequential
element exists only when the user starts "Play All Book" and is destroyed
when they stop.

Continue to [`14-vadoo-video.md`](14-vadoo-video.md).
