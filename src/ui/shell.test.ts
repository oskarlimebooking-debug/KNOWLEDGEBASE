import { describe, expect, it } from 'vitest';
import { renderAppShell, renderSpinner } from './shell';
import type { ShellNode } from './dom';

function find(node: ShellNode, predicate: (n: ShellNode) => boolean): ShellNode | null {
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    const hit = find(child, predicate);
    if (hit !== null) return hit;
  }
  return null;
}

function findAll(node: ShellNode, predicate: (n: ShellNode) => boolean): ShellNode[] {
  const out: ShellNode[] = [];
  if (predicate(node)) out.push(node);
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    out.push(...findAll(child, predicate));
  }
  return out;
}

describe('renderAppShell', () => {
  it('roots as <div class="app view-library"> with data-view="library"', () => {
    const tree = renderAppShell();
    expect(tree.tag).toBe('div');
    expect(tree.className).toBe('app view-library');
    expect(tree.attrs?.['data-view']).toBe('library');
  });

  it('contains a header with back, title, and settings controls', () => {
    const tree = renderAppShell();
    const back = find(tree, (n) => n.attrs?.['data-role'] === 'back');
    const settings = find(tree, (n) => n.attrs?.['data-role'] === 'settings');
    const title = find(tree, (n) => n.tag === 'h1');
    expect(back?.attrs?.['aria-label']).toBe('Back');
    expect(settings?.attrs?.['aria-label']).toBe('Settings');
    expect(title?.children?.[0]).toBe('Headway');
  });

  it('contains all four view panes', () => {
    const tree = renderAppShell();
    const panes = findAll(tree, (n) => n.attrs?.['data-pane'] !== undefined);
    expect(panes.map((p) => p.attrs!['data-pane']).sort()).toEqual(
      ['book', 'chapter', 'library', 'modal-stack'].sort(),
    );
  });

  it('hides every pane except library on first render', () => {
    const tree = renderAppShell();
    const panes = findAll(tree, (n) => n.attrs?.['data-pane'] !== undefined);
    const visible = panes.filter((p) => p.attrs!['aria-hidden'] === 'false');
    expect(visible).toHaveLength(1);
    expect(visible[0]!.attrs!['data-pane']).toBe('library');
  });

  it('contains a toast container', () => {
    const tree = renderAppShell();
    const toast = find(tree, (n) => n.attrs?.['data-role'] === 'toast-container');
    expect(toast).not.toBeNull();
    expect(toast?.attrs?.['aria-live']).toBe('polite');
  });

  it('contains a spinner with role=status and hidden by default', () => {
    const tree = renderAppShell();
    const spinner = find(tree, (n) => n.className === 'spinner');
    expect(spinner?.attrs?.role).toBe('status');
    expect(spinner?.attrs?.['aria-label']).toBe('Loading');
    expect(spinner?.attrs).toHaveProperty('hidden');
  });

  it('never carries HTML-string children (no innerHTML risk)', () => {
    // Regression guard: every string in the tree must be plain text.
    const visit = (node: ShellNode): void => {
      for (const child of node.children ?? []) {
        if (typeof child === 'string') {
          expect(child).not.toMatch(/<[a-z]/i);
        } else {
          visit(child);
        }
      }
    };
    visit(renderAppShell());
  });

  it('renderSpinner exposes the same data when called directly', () => {
    const s = renderSpinner();
    expect(s.className).toBe('spinner');
    expect(s.attrs?.role).toBe('status');
  });
});
