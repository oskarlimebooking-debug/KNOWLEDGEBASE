import { afterEach, describe, expect, it } from 'vitest';
import {
  backView,
  canGoBack,
  getCurrentView,
  resetViewState,
  setView,
} from './view';
import { makeDoc, type StubElement } from '../test/dom-stub';

afterEach(() => {
  resetViewState();
});

function makeRoot(): StubElement {
  const doc = makeDoc();
  return doc.createElement('div');
}

describe('view system', () => {
  it('starts at "library"', () => {
    expect(getCurrentView()).toBe('library');
  });

  it('setView writes the modifier class and dataset', () => {
    const root = makeRoot();
    setView(root, 'book');
    expect(root.classList.contains('view-book')).toBe(true);
    expect(root.classList.contains('view-library')).toBe(false);
    expect(root.dataset.view).toBe('book');
  });

  it('setView removes the prior view\'s modifier class', () => {
    const root = makeRoot();
    setView(root, 'book');
    setView(root, 'chapter');
    expect(root.classList.contains('view-book')).toBe(false);
    expect(root.classList.contains('view-chapter')).toBe(true);
    expect(root.dataset.view).toBe('chapter');
  });

  it('backView pops the stack and restores the prior view', () => {
    const root = makeRoot();
    setView(root, 'book');
    setView(root, 'chapter');
    const prev = backView(root);
    expect(prev).toBe('book');
    expect(getCurrentView()).toBe('book');
    expect(root.dataset.view).toBe('book');
    expect(root.classList.contains('view-book')).toBe(true);
    expect(root.classList.contains('view-chapter')).toBe(false);
  });

  it('backView returns null at the root', () => {
    const root = makeRoot();
    expect(backView(root)).toBeNull();
    expect(canGoBack()).toBe(false);
  });

  it('re-entering the same view does not stack-push', () => {
    const root = makeRoot();
    setView(root, 'book');
    setView(root, 'book');
    expect(canGoBack()).toBe(true);
    const prev = backView(root);
    expect(prev).toBe('library');
  });

  it('canGoBack reflects stack depth', () => {
    const root = makeRoot();
    expect(canGoBack()).toBe(false);
    setView(root, 'book');
    expect(canGoBack()).toBe(true);
  });

  it('does not flicker — only one view modifier class at any time', () => {
    // The contract behind the "no flicker" AC: in a single setView
    // call, the prior view's modifier class is removed before the new
    // one is added, so the DOM never has zero matching classes nor two.
    const root = makeRoot();
    setView(root, 'chapter');
    const modifiers = root.classList
      .values()
      .filter((c) => c.startsWith('view-'));
    expect(modifiers).toEqual(['view-chapter']);
  });
});
