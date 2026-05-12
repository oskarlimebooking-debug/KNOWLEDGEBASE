// Offline banner.
//
// Every Sprint-A feature path uses IDB only — no fetch() calls in app
// code. The banner is purely informational: it tells the user "yes,
// you're offline, but the app keeps working." Toggled by the standard
// online/offline window events; mirrors `navigator.onLine` on mount.

import { buildElement, type ShellNode } from './dom';

const BANNER_CLASS = 'offline-banner';

function tree(): ShellNode {
  return {
    tag: 'div',
    className: BANNER_CLASS,
    attrs: { role: 'status', 'aria-live': 'polite', 'data-role': 'offline-banner' },
    children: [
      { tag: 'span', className: 'offline-banner__icon', attrs: { 'aria-hidden': 'true' }, children: ['📡'] },
      {
        tag: 'span',
        className: 'offline-banner__msg',
        children: ["You're offline. Changes save locally."],
      },
    ],
  };
}

export interface OfflineBannerHandle {
  destroy: () => void;
}

export function mountOfflineBanner(
  parent: HTMLElement,
  win: Window = window,
  doc: Document = document,
): OfflineBannerHandle {
  let bannerEl: HTMLElement | null = null;

  const show = (): void => {
    if (bannerEl !== null) return;
    bannerEl = buildElement(tree(), doc);
    parent.appendChild(bannerEl);
  };
  const hide = (): void => {
    if (bannerEl === null) return;
    bannerEl.remove();
    bannerEl = null;
  };

  const onOnline = (): void => hide();
  const onOffline = (): void => show();

  win.addEventListener('online', onOnline);
  win.addEventListener('offline', onOffline);

  if (win.navigator.onLine === false) show();

  return {
    destroy: () => {
      win.removeEventListener('online', onOnline);
      win.removeEventListener('offline', onOffline);
      hide();
    },
  };
}
