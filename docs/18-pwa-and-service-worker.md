# 18 — PWA and Service Worker

The app is a fully installable PWA. It can be added to the home screen,
launched standalone, and works offline (except for the AI APIs and the
cloud sync, which need the network).

## `manifest.json`

```jsonc
{
  "name": "ChapterWise — Daily Learning",
  "short_name": "ChapterWise",
  "description": "Read a chapter every day. Learn something new.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f1a",
  "theme_color": "#1a1a2e",
  "orientation": "any",
  "icons": [
    {
      "src": "data:image/svg+xml,<svg ...>📖</svg>",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ],
  "categories": ["education", "books", "productivity"],
  "lang": "en"
}
```

The icon is an inline SVG data URL — no separate icon files needed.

The `theme_color` matches the dark UI background. `apple-mobile-web-app-*`
metas in the `<head>` of `index.html` make iOS render the standalone
experience properly.

## Service worker (`sw.js`)

`CACHE_NAME = 'chapterwise-v5'` — bump the version any time you ship a
breaking change to assets.

### Pre-cache list

Hardcoded on install:

```js
[
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Crimson+Pro:..&family=DM+Sans:...&display=swap'
]
```

Note: `jspdf` is **not** cached — only loaded when the user uses
"Save PDF with highlights".

### Install

`event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(...)))`.

**Does NOT call `self.skipWaiting()`.** Updates are applied manually only,
preventing the user from being interrupted mid-action.

### Activate

Cleans up old cache versions. Does NOT call `clients.claim()`. The new SW
takes effect on the next manual reload.

### Fetch

The fetch handler does three things:

1. **Pass-through** for non-GET requests.
2. **Pass-through (network)** for any URL matching the API allowlist:
   - `generativelanguage.googleapis.com`
   - `api.lazybird.app`
   - `accounts.google.com`, `oauth2.googleapis.com`, `apis.google.com`
   - `www.googleapis.com/drive`
   - `aiapi.vadoo.tv`, `getmerlin.in`, `junia.ai`
   - `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`
   - `supabase.co` (legacy, unused)
   - `api.docanalyzer.ai`
   - `/api/vadoo`, `/api/docanalyzer` (the in-app proxies)
   - `chapterwise-import.json` (always fresh)
3. **Cache-first** for everything else: try cache, fall back to network,
   cache successful 200 responses.
4. **HTML offline fallback**: navigation requests get `/index.html` from
   cache when offline.

### Push notifications (placeholder)

The SW handles `push` events to show "Time for your daily reading!"
notifications. In production this requires a push service (FCM/Web Push)
which the app doesn't currently provision. The handler exists for future
use.

```js
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Time for your daily reading!',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    actions: [
      { action: 'read', title: 'Start Reading' },
      { action: 'later', title: 'Remind Later' }
    ]
  };
  event.waitUntil(self.registration.showNotification('ChapterWise', options));
});
```

### Background sync (placeholder)

`sync` event with tag `sync-progress` is wired to a no-op
`syncProgress()` function. Reserved for future cloud sync without the
foreground tab.

### Manual update mechanism

`index.html:21334–21430` implements:

- `checkForAppUpdate()` — sends `{ type: 'CHECK_FOR_UPDATE' }` to the SW;
  if a new SW is installed and waiting, shows the **Update available**
  button (`showUpdateButton()`).
- `applyUpdate()` — sends `{ type: 'SKIP_WAITING' }` and reloads.
- `forceAppUpdate()` — sends `{ type: 'PURGE_CACHES' }` to wipe all
  caches, unregisters the SW, then reloads.

The page-level registration code (`index.html:26287`) listens for
`updatefound` and toggles `updateAvailable` when an installed worker is
ready.

## Why no `skipWaiting`?

If a new SW activates while the user is mid-edit (e.g. composing a
manual chapter list), the page would reload silently. The manual update
flow puts the user in control.

## Versioning discipline

When you ship:

1. Bump `CACHE_NAME` in `sw.js` (e.g. `chapterwise-v5` → `v6`).
2. Anyone with the old SW gets a "new version available" toast.
3. They click Update and the new SW skipWaitings + reloads.

Forgetting to bump the version means stale clients keep the old SW until
their browser garbage-collects it.

## Service worker lifecycle quirks

- iOS sometimes ignores `self.skipWaiting` until the user navigates away
  and back. The forced reload after `controllerchange` handles this.
- Safari can occasionally cache stale GIS bundles. The
  `loadGoogleIdentityServices` helper removes any old `<script>` tag
  before re-injecting.

## Offline behavior

Works offline:
- Library browsing
- Read mode
- Browser TTS
- Cached AI artefacts (summary, quiz, flashcards, feed, mind map)
- PDF viewer
- Cached audio playback

Requires network:
- New AI generations
- Lazybird / Google TTS generation
- Image generation
- Vadoo video
- Cloud sync
- OAuth / token refresh

Continue to [`19-pdf-viewer.md`](19-pdf-viewer.md).
