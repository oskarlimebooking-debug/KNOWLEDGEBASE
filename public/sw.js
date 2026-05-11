// Headway service worker — Phase A scaffold.
// Cache the app shell + static build assets only. Anything that looks
// like an API call, an HTML fragment, or a user-data fetch is passed
// through to the network and never enters caches.* — see the audit
// note (P2-#6): once Phase G/Phase I introduce real fetches, an
// indefinitely-caching SW would silently retain PII and auth state.
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
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

  if (!isCacheable(url)) {
    // API/auth/user-data path — pass through, do not cache.
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
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
