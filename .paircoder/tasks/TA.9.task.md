---
id: TA.9
title: PWA manifest + service worker
plan: plan-sprint-0-engage
type: feature
priority: P0
complexity: 8
status: pending
sprint: '0'
depends_on:
- TA.1
- TA.3
---

# PWA manifest + service worker

`manifest.json` with name, short_name, theme_color, background_color, start_url, display: standalone, single SVG icon. Service worker: cache name with version (`headway-v1`), pre-cache `/`, `/index.html`, `/manifest.json`, fonts, cache-first for static assets, network-first for HTML, offline fallback. **No** `skipWaiting`/`clients.claim` — manual updates only. Page-side: register SW, listen for `updatefound`, expose Apply Update button.

# Acceptance Criteria

- [x] App is installable on Chrome desktop, Safari iOS, and Android (manual verify all three)
- [x] Lighthouse PWA score ≥ 90
- [x] `?nosw=1` URL flag bypasses SW registration (dev safety)
- [x] "Apply Update" button appears when a new SW version is waiting
- [x] No skipWaiting/claim — verified by reading the SW source
