// Update banner — appears when a new service worker is waiting.
//
// Strategy: append a small, fixed-position banner to `<body>` (not the
// app shell) so it sits above everything and remains visible during
// navigation. Click "Apply" → postMessage SKIP_WAITING via applyUpdate.

import { applyUpdate } from '../lib/sw-update';
import { buildElement, type ShellNode } from './dom';

export interface BannerHandle {
  element: HTMLElement;
  dismiss: () => void;
}

function bannerTree(): ShellNode {
  return {
    tag: 'div',
    className: 'update-banner',
    attrs: { role: 'status', 'aria-live': 'polite', 'data-role': 'update-banner' },
    children: [
      {
        tag: 'span',
        className: 'update-banner__msg',
        children: ['New version available.'],
      },
      {
        tag: 'button',
        className: 'update-banner__apply',
        attrs: { type: 'button' },
        children: ['Apply Update'],
      },
      {
        tag: 'button',
        className: 'update-banner__dismiss',
        attrs: { type: 'button', 'aria-label': 'Dismiss' },
        children: ['×'],
      },
    ],
  };
}

export function showUpdateBanner(
  reg: ServiceWorkerRegistration,
  parent: HTMLElement,
  doc: Document = document,
): BannerHandle {
  // Idempotent: if a banner is already mounted, return that one.
  const existing = parent.querySelector('.update-banner') as HTMLElement | null;
  if (existing !== null) {
    return { element: existing, dismiss: () => existing.remove() };
  }

  const el = buildElement(bannerTree(), doc);
  parent.appendChild(el);

  const apply = el.querySelector('.update-banner__apply') as HTMLElement | null;
  apply?.addEventListener('click', () => {
    applyUpdate(reg);
  });

  const dismissBtn = el.querySelector('.update-banner__dismiss') as HTMLElement | null;
  const dismiss = (): void => el.remove();
  dismissBtn?.addEventListener('click', dismiss);

  return { element: el, dismiss };
}
