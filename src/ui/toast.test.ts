import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast, toastDurationMs, type ToastKind } from './toast';
import { asHTMLElement, makeDoc, type StubElement } from '../test/dom-stub';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeContainer(): StubElement {
  const doc = makeDoc();
  return doc.createElement('div');
}

describe('showToast', () => {
  it('appends a toast with the kind modifier class', () => {
    const container = makeContainer();
    showToast(asHTMLElement(container) as never, 'hello', 'success');
    expect(container.children).toHaveLength(1);
    const child = container.children[0]!;
    expect(child.className).toBe('toast toast--success');
    expect(child.textContent).toBe('hello');
  });

  it('defaults kind to info', () => {
    const container = makeContainer();
    showToast(asHTMLElement(container) as never, 'hi');
    expect(container.children[0]!.className).toBe('toast toast--info');
  });

  it('auto-dismisses after the per-kind duration', () => {
    const container = makeContainer();
    showToast(asHTMLElement(container) as never, 'gone', 'info');
    expect(container.children).toHaveLength(1);
    vi.advanceTimersByTime(toastDurationMs('info'));
    expect(container.children).toHaveLength(0);
  });

  it('renders all four kinds', () => {
    const container = makeContainer();
    const kinds: ToastKind[] = ['info', 'success', 'warn', 'error'];
    for (const k of kinds) showToast(asHTMLElement(container) as never, k, k);
    expect(container.children).toHaveLength(4);
    expect(container.children.map((c) => c.className)).toEqual([
      'toast toast--info',
      'toast toast--success',
      'toast toast--warn',
      'toast toast--error',
    ]);
  });

  it('handle.dismiss removes the toast immediately', () => {
    const container = makeContainer();
    const handle = showToast(asHTMLElement(container) as never, 'bye', 'info');
    handle.dismiss();
    expect(container.children).toHaveLength(0);
  });

  it('dismiss is idempotent', () => {
    const container = makeContainer();
    const handle = showToast(asHTMLElement(container) as never, 'bye', 'info');
    handle.dismiss();
    expect(() => handle.dismiss()).not.toThrow();
    expect(container.children).toHaveLength(0);
  });

  it('sets aria-live=assertive for warn and error', () => {
    const container = makeContainer();
    showToast(asHTMLElement(container) as never, 'oh no', 'error');
    showToast(asHTMLElement(container) as never, 'careful', 'warn');
    expect(container.children[0]!.getAttribute('aria-live')).toBe('assertive');
    expect(container.children[1]!.getAttribute('aria-live')).toBe('assertive');
  });

  it('sets aria-live=polite for info and success', () => {
    const container = makeContainer();
    showToast(asHTMLElement(container) as never, 'hi', 'info');
    showToast(asHTMLElement(container) as never, 'yay', 'success');
    expect(container.children[0]!.getAttribute('aria-live')).toBe('polite');
    expect(container.children[1]!.getAttribute('aria-live')).toBe('polite');
  });

  it('per-kind durations are info=3s, success=3s, warn=5s, error=6s', () => {
    expect(toastDurationMs('info')).toBe(3000);
    expect(toastDurationMs('success')).toBe(3000);
    expect(toastDurationMs('warn')).toBe(5000);
    expect(toastDurationMs('error')).toBe(6000);
  });

  it('overrides duration when explicit ms passed', () => {
    const container = makeContainer();
    showToast(asHTMLElement(container) as never, 'short', 'info', 100);
    vi.advanceTimersByTime(100);
    expect(container.children).toHaveLength(0);
  });
});
