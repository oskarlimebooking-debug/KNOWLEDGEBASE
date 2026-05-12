import { describe, expect, it } from 'vitest';
import { openConfirm } from './confirm';
import { asDocument, asHTMLElement, makeDoc } from '../test/dom-stub';

describe('openConfirm', () => {
  it('mounts an alertdialog into the stack', async () => {
    const doc = makeDoc();
    const stack = doc.createElement('div');
    const p = openConfirm(
      asHTMLElement(stack),
      { title: 'T', message: 'M' },
      asDocument(doc),
    );
    expect(stack.children).toHaveLength(1);
    const modal = stack.children[0]!.children[0]!;
    expect(modal.getAttribute('role')).toBe('alertdialog');
    expect(stack.getAttribute('aria-hidden')).toBe('false');
    // Cancel to flush the promise.
    const cancel = stack.children[0]!.querySelector('[data-role="cancel"]');
    cancel!.dispatchEvent('click');
    await p;
  });

  it('resolves true when confirm is clicked', async () => {
    const doc = makeDoc();
    const stack = doc.createElement('div');
    const p = openConfirm(
      asHTMLElement(stack),
      { title: 'T', message: 'M', confirmLabel: 'Yes' },
      asDocument(doc),
    );
    const btn = stack.children[0]!.querySelector('[data-role="confirm"]');
    btn!.dispatchEvent('click');
    await expect(p).resolves.toBe(true);
  });

  it('resolves false when cancel is clicked', async () => {
    const doc = makeDoc();
    const stack = doc.createElement('div');
    const p = openConfirm(
      asHTMLElement(stack),
      { title: 'T', message: 'M' },
      asDocument(doc),
    );
    const btn = stack.children[0]!.querySelector('[data-role="cancel"]');
    btn!.dispatchEvent('click');
    await expect(p).resolves.toBe(false);
  });

  it('resolves false on Escape (AC #3)', async () => {
    const doc = makeDoc();
    const stack = doc.createElement('div');
    const p = openConfirm(
      asHTMLElement(stack),
      { title: 'T', message: 'M' },
      asDocument(doc),
    );
    // Simulate Escape via the doc's listener registry.
    (asDocument(doc) as unknown as { dispatchEvent(e: string, p: unknown): void }).dispatchEvent(
      'keydown',
      { key: 'Escape' },
    );
    await expect(p).resolves.toBe(false);
    expect(stack.children).toHaveLength(0);
  });

  it('applies destructive class when destructive=true', async () => {
    const doc = makeDoc();
    const stack = doc.createElement('div');
    const p = openConfirm(
      asHTMLElement(stack),
      { title: 'T', message: 'M', destructive: true, confirmLabel: 'Delete' },
      asDocument(doc),
    );
    const btn = stack.children[0]!.querySelector('[data-role="confirm"]');
    expect(btn?.className.includes('modal__action--destructive')).toBe(true);
    btn!.dispatchEvent('click');
    await p;
  });
});
