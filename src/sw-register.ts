// Page-side service worker registration + update orchestration.
//
// Audit-aligned with TA.9: the SW does not auto-skipWaiting on install,
// so a new version waits for explicit user opt-in. This module hooks
// the registration and surfaces a banner UI when a waiting worker is
// detected — clicking Apply postMessages SKIP_WAITING and reloads on
// controllerchange. `?nosw=1` bypasses registration entirely.

import { watchForUpdates } from './lib/sw-update';
import { showUpdateBanner } from './ui/update-banner';

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  if (new URLSearchParams(window.location.search).has('nosw')) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        watchForUpdates(reg, (r) => {
          showUpdateBanner(r, document.body);
        });
      })
      .catch((err) => {
        console.warn('[headway] service worker registration failed', err);
      });
  });
}
