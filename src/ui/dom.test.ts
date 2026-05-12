import { describe, expect, it } from 'vitest';
import { buildElement } from './dom';
import { asDocument, makeDoc } from '../test/dom-stub';

describe('buildElement', () => {
  it('creates an element with the given tag', () => {
    const doc = makeDoc();
    const el = buildElement({ tag: 'div' }, asDocument(doc)) as unknown as {
      tagName: string;
    };
    expect(el.tagName).toBe('div');
  });

  it('assigns className when provided', () => {
    const doc = makeDoc();
    const el = buildElement({ tag: 'div', className: 'foo' }, asDocument(doc)) as unknown as {
      className: string;
    };
    expect(el.className).toBe('foo');
  });

  it('applies every entry in attrs via setAttribute', () => {
    const doc = makeDoc();
    const el = buildElement(
      { tag: 'button', attrs: { type: 'button', 'aria-label': 'Back' } },
      asDocument(doc),
    ) as unknown as { getAttribute(n: string): string | null };
    expect(el.getAttribute('type')).toBe('button');
    expect(el.getAttribute('aria-label')).toBe('Back');
  });

  it('appends string children as text nodes', () => {
    const doc = makeDoc();
    const el = buildElement(
      { tag: 'p', children: ['hello'] },
      asDocument(doc),
    ) as unknown as { children: Array<{ tagName: string; textContent: string }> };
    expect(el.children).toHaveLength(1);
    expect(el.children[0]!.tagName).toBe('#text');
    expect(el.children[0]!.textContent).toBe('hello');
  });

  it('recurses into nested children', () => {
    const doc = makeDoc();
    const el = buildElement(
      {
        tag: 'main',
        children: [
          { tag: 'h1', children: ['Title'] },
          { tag: 'p', className: 'body', children: ['Body'] },
        ],
      },
      asDocument(doc),
    ) as unknown as {
      children: Array<{ tagName: string; className: string; children: Array<{ textContent: string }> }>;
    };
    expect(el.children).toHaveLength(2);
    expect(el.children[0]!.tagName).toBe('h1');
    expect(el.children[0]!.children[0]!.textContent).toBe('Title');
    expect(el.children[1]!.className).toBe('body');
  });

  it('handles a node with no children gracefully', () => {
    const doc = makeDoc();
    const el = buildElement({ tag: 'span' }, asDocument(doc)) as unknown as {
      children: unknown[];
    };
    expect(el.children).toHaveLength(0);
  });

  it('never assigns innerHTML', () => {
    // Regression guard: prove buildElement only uses safe DOM APIs by
    // crashing if anything attempts innerHTML assignment on a stub.
    const doc = makeDoc();
    const el = buildElement({ tag: 'div', children: ['<script>'] }, asDocument(doc));
    // The <script> string lives as a text node; it never reaches innerHTML.
    const stub = el as unknown as { children: Array<{ textContent: string }> };
    expect(stub.children[0]!.textContent).toBe('<script>');
  });
});
