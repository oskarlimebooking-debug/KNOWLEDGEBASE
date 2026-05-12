import { afterEach, describe, expect, it } from 'vitest';
import { mountOfflineBanner } from './offline-banner';
import { asDocument, asHTMLElement, makeDoc, type StubElement } from '../test/dom-stub';

// Minimal Window mock implementing what the banner touches.
interface FakeWindow {
  navigator: { onLine: boolean };
  listeners: Map<string, Array<() => void>>;
  addEventListener: (event: string, fn: () => void) => void;
  removeEventListener: (event: string, fn: () => void) => void;
  fire: (event: string) => void;
}

function makeWin(initialOnline = true): FakeWindow {
  const listeners = new Map<string, Array<() => void>>();
  return {
    navigator: { onLine: initialOnline },
    listeners,
    addEventListener(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(fn);
    },
    removeEventListener(event, fn) {
      const arr = listeners.get(event);
      if (!arr) return;
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    },
    fire(event) {
      for (const fn of listeners.get(event) ?? []) fn();
    },
  };
}

function setupBanner(initialOnline: boolean): { parent: StubElement; win: FakeWindow } {
  const doc = makeDoc();
  const parent = doc.createElement('div');
  const win = makeWin(initialOnline);
  mountOfflineBanner(asHTMLElement(parent), win as unknown as Window, asDocument(doc));
  return { parent, win };
}

afterEach(() => {
  // no global state to reset
});

describe('mountOfflineBanner', () => {
  it('does not render the banner when starting online', () => {
    const { parent } = setupBanner(true);
    expect(parent.children).toHaveLength(0);
  });

  it('renders the banner when starting offline', () => {
    const { parent } = setupBanner(false);
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]!.classList.contains('offline-banner')).toBe(true);
  });

  it('shows the banner on the offline event', () => {
    const { parent, win } = setupBanner(true);
    win.fire('offline');
    expect(parent.children).toHaveLength(1);
  });

  it('removes the banner on the online event', () => {
    const { parent, win } = setupBanner(false);
    expect(parent.children).toHaveLength(1);
    win.fire('online');
    expect(parent.children).toHaveLength(0);
  });

  it('does not double-mount on repeated offline events', () => {
    const { parent, win } = setupBanner(true);
    win.fire('offline');
    win.fire('offline');
    expect(parent.children).toHaveLength(1);
  });

  it('destroy() removes listeners and the banner', () => {
    const doc = makeDoc();
    const parent = doc.createElement('div');
    const win = makeWin(false);
    const handle = mountOfflineBanner(asHTMLElement(parent), win as unknown as Window, asDocument(doc));
    expect(parent.children).toHaveLength(1);
    handle.destroy();
    expect(parent.children).toHaveLength(0);
    // Listeners should be cleared — firing offline again does nothing.
    win.fire('offline');
    expect(parent.children).toHaveLength(0);
  });
});
