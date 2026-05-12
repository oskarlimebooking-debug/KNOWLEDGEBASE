import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountApp, setSettingsHandler } from './app';
import { resetViewState, setView } from './ui/view';
import { asHTMLElement, makeDoc } from './test/dom-stub';

afterEach(() => {
  resetViewState();
  setSettingsHandler(() => {});
});

describe('mountApp', () => {
  it('throws if root element is null', () => {
    expect(() => mountApp(null)).toThrow(/#app root/);
  });

  it('mounts the app shell into the root', () => {
    const doc = makeDoc();
    // Patch global document so buildElement (default doc=document) targets
    // the stub. Restoring is unnecessary — Vitest discards the global mock
    // when the test file finishes.
    vi.stubGlobal('document', doc);
    const root = doc.createElement('div');
    mountApp(asHTMLElement(root));
    expect(root.children).toHaveLength(1);
    const app = root.children[0]!;
    expect(app.tagName).toBe('div');
    expect(app.className).toBe('app view-library');
    expect(app.dataset.view).toBeUndefined();
    expect(app.getAttribute('data-view')).toBe('library');
  });

  it('wires the header back button to backView', () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    const root = doc.createElement('div');
    mountApp(asHTMLElement(root));
    const app = root.children[0]!;
    // Push the user into a non-root view.
    setView(app as never, 'book');
    expect(app.dataset.view).toBe('book');
    // Click the header back button.
    const back = app.querySelector('.app-header__back');
    expect(back).not.toBeNull();
    back!.dispatchEvent('click');
    expect(app.dataset.view).toBe('library');
  });

  it('wires the settings button to the registered handler', () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    const root = doc.createElement('div');
    mountApp(asHTMLElement(root));
    const handler = vi.fn();
    setSettingsHandler(handler);
    const settings = root.children[0]!.querySelector('.app-header__settings');
    settings!.dispatchEvent('click');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('settings click is a no-op when no handler is registered', () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    const root = doc.createElement('div');
    mountApp(asHTMLElement(root));
    // Reset to no-op handler so the click is silent.
    setSettingsHandler(() => {});
    const settings = root.children[0]!.querySelector('.app-header__settings');
    expect(() => settings!.dispatchEvent('click')).not.toThrow();
  });
});
