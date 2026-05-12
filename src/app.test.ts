import { describe, it, expect } from 'vitest';
import { mountApp, renderShell } from './app';

describe('renderShell', () => {
  it('builds a static data tree (no HTML strings)', () => {
    const tree = renderShell();
    expect(tree.tag).toBe('main');
    expect(tree.className).toBe('shell');
    // The phase-A scaffold contains a heading and two paragraphs.
    expect(tree.children).toHaveLength(3);
  });

  it('contains the expected scaffold copy as plain strings', () => {
    const tree = renderShell();
    const allText = JSON.stringify(tree);
    expect(allText).toContain('Headway');
    expect(allText).toContain('Phase A scaffold');
  });

  it('never carries HTML-string children', () => {
    // Defense-in-depth: every string in the tree is plain text that
    // buildElement assigns via createTextNode. If a regression ever
    // injects raw markup here, this test fails before it hits the DOM.
    const visit = (node: { children: ReadonlyArray<unknown> }): void => {
      for (const child of node.children) {
        if (typeof child === 'string') {
          expect(child).not.toMatch(/[<>]/);
        } else {
          visit(child as { children: ReadonlyArray<unknown> });
        }
      }
    };
    visit(renderShell());
  });
});

describe('mountApp', () => {
  it('throws if root element is null', () => {
    expect(() => mountApp(null)).toThrow(/#app root/);
  });
});
