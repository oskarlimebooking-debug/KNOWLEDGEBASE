import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  WPM_DEFAULT,
  WPM_MAX,
  WPM_MIN,
  openSettings,
  validateWpm,
} from './settings';
import { closeDb, setSetting } from '../data/db';
import { asDocument, asHTMLElement, makeDoc } from '../test/dom-stub';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

describe('validateWpm', () => {
  it('accepts values inside [50, 1000]', () => {
    expect(validateWpm('250')).toEqual({ ok: true, value: 250 });
    expect(validateWpm('50')).toEqual({ ok: true, value: 50 });
    expect(validateWpm('1000')).toEqual({ ok: true, value: 1000 });
  });

  it('rejects empty', () => {
    expect(validateWpm('').ok).toBe(false);
    expect(validateWpm('   ').ok).toBe(false);
  });

  it('rejects non-numeric', () => {
    expect(validateWpm('fast').ok).toBe(false);
    expect(validateWpm('NaN').ok).toBe(false);
  });

  it('rejects non-integer', () => {
    expect(validateWpm('250.5').ok).toBe(false);
  });

  it('rejects out-of-range', () => {
    const lo = validateWpm('49');
    expect(lo.ok).toBe(false);
    if (!lo.ok) expect(lo.error).toMatch(/between/);
    const hi = validateWpm('1001');
    expect(hi.ok).toBe(false);
  });

  it('exposes the documented bounds', () => {
    expect(WPM_MIN).toBe(50);
    expect(WPM_MAX).toBe(1000);
    expect(WPM_DEFAULT).toBe(250);
  });
});

describe('openSettings', () => {
  it('mounts the modal into the stack and sets aria-hidden=false', async () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    const stack = doc.createElement('div');
    stack.setAttribute('aria-hidden', 'true');
    await openSettings(asHTMLElement(stack), asDocument(doc));
    expect(stack.children).toHaveLength(1);
    expect(stack.getAttribute('aria-hidden')).toBe('false');
    const modal = stack.children[0]!.children[0]!;
    expect(modal.className).toBe('modal');
    expect(modal.getAttribute('role')).toBe('dialog');
  });

  it('renders Reading and Data sections', async () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    const stack = doc.createElement('div');
    await openSettings(asHTMLElement(stack), asDocument(doc));
    const headings: string[] = [];
    const walk = (node: { tagName: string; textContent: string; children: { tagName: string; textContent: string; children: unknown[] }[] }): void => {
      if (node.tagName === 'h3') headings.push(node.textContent);
      for (const c of node.children) walk(c as never);
    };
    walk(stack as never);
    expect(headings).toEqual(['Reading', 'Data']);
  });

  it('seeds the WPM input from setSetting (or default)', async () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    await setSetting('readingSpeed', 320);
    const stack = doc.createElement('div');
    await openSettings(asHTMLElement(stack), asDocument(doc));
    const input = stack.children[0]!.querySelector('.settings__input');
    expect(input?.getAttribute('value')).toBe('320');
  });

  it('falls back to WPM_DEFAULT when no setting is stored', async () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    const stack = doc.createElement('div');
    await openSettings(asHTMLElement(stack), asDocument(doc));
    const input = stack.children[0]!.querySelector('.settings__input');
    expect(input?.getAttribute('value')).toBe(String(WPM_DEFAULT));
  });

  it('close button removes the modal', async () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    const stack = doc.createElement('div');
    await openSettings(asHTMLElement(stack), asDocument(doc));
    expect(stack.children).toHaveLength(1);
    const closeBtn = stack.children[0]!.querySelector('.modal__close');
    closeBtn!.dispatchEvent('click');
    expect(stack.children).toHaveLength(0);
    expect(stack.getAttribute('aria-hidden')).toBe('true');
  });

  it('handle.close is idempotent', async () => {
    const doc = makeDoc();
    vi.stubGlobal('document', doc);
    const stack = doc.createElement('div');
    const handle = await openSettings(asHTMLElement(stack), asDocument(doc));
    handle.close();
    expect(() => handle.close()).not.toThrow();
    expect(stack.children).toHaveLength(0);
  });
});
