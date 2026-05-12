// Headway service worker — Phase A scaffold.
// Cache the app shell + static build assets only. Anything that looks
// like an API call, an HTML fragment, or a user-data fetch is passed
// through to the network and never enters caches.* — see phase-A audit
// P2-#6: once Phase G/Phase I introduce real fetches, an indefinitely-
// caching SW would silently retain PII and auth state.
// Replaced with a richer SW in TA.9.

const CACHE_VERSION = 'headway-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

// Extensions that are safe to cache long-term: built static assets and
// fonts. Hashed Vite output makes these self-invalidating per release.
const STATIC_EXTS = /\.(?:js|mjs|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|webp|avif|svg|ico)$/i;

// Path prefixes that must NEVER be cached, even if same-origin and GET.
// Add new server-side surfaces here as they are introduced.
const NEVER_CACHE_PREFIXES = ['/api/', '/auth/', '/oauth/'];

function isCacheable(url) {
  if (NEVER_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return false;
  if (SHELL.includes(url.pathname)) return true;
  return STATIC_EXTS.test(url.pathname);
}

// Audit P2-#3 defense-in-depth: refuse to cache a response unless its
// `Content-Type` matches the class implied by the URL extension. Without
// this, a future origin handler that mis-serves text/html under a `.js`
// URL would poison the cache and break navigation isolation.
function isContentTypeValid(url, res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const path = url.pathname;
  const dot = path.lastIndexOf('.');
  if (dot < 0) return ct.startsWith('text/html'); // SHELL root ("/")
  const ext = path.slice(dot + 1).toLowerCase();
  if (ext === 'js' || ext === 'mjs') return /^(application|text)\/(java|ecma)script\b/.test(ct);
  if (ext === 'css') return ct.startsWith('text/css');
  if (/^(woff2?|ttf|otf|eot)$/.test(ext)) return ct.startsWith('font/') || ct.startsWith('application/vnd.ms-fontobject');
  if (/^(png|jpe?g|gif|webp|avif|svg|ico)$/.test(ext)) return ct.startsWith('image/');
  if (ext === 'webmanifest') return ct.startsWith('application/manifest+json') || ct.startsWith('application/json');
  if (ext === 'html') return ct.startsWith('text/html');
  if (ext === 'json') return ct.startsWith('application/json');
  return false;
}

self.addEventListener('install', (event) => {
  // No skipWaiting() — TA.9 contract is manual updates only. The new
  // worker waits until the user clicks "Apply Update" in the page UI,
  // which postMessages SKIP_WAITING (see the message handler below).
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL))
  );
});

self.addEventListener('activate', (event) => {
  // No clients.claim() — when the user accepts the update, the page
  // reloads on controllerchange and the new worker naturally takes
  // over the fresh navigation. Avoid grabbing existing tabs mid-flow.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network-first for HTML navigations so the user always sees fresh
    // markup; fall back to the cached shell offline. The navigation
    // response itself is NOT cached — only the precached shell is.
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (!isCacheable(url)) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic' && isContentTypeValid(url, res)) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
