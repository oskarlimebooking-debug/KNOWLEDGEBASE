// App shell — the structural DOM that wraps every view.
//
// `renderAppShell()` returns the full shell as a `ShellNode` data tree:
// header (back button, title, settings gear), the four view panes
// (library, book, chapter, modal-stack), a toast container, and a
// spinner overlay. View panes are present but empty — feature code
// populates them lazily. CSS hides every pane except the one matching
// `root.dataset.view`.
//
// Why empty panes up front: reserves layout space so the first paint
// matches the steady state. This is the CLS-zero invariant — no
// element ever shifts because content was inserted after first paint.

import type { ShellNode } from './dom';

export const SHELL_HEADER_HEIGHT = '3.5rem';

function header(): ShellNode {
  return {
    tag: 'header',
    className: 'app-header',
    children: [
      {
        tag: 'button',
        className: 'app-header__back',
        attrs: { type: 'button', 'aria-label': 'Back', 'data-role': 'back' },
        children: ['‹'],
      },
      {
        tag: 'h1',
        className: 'app-header__title',
        children: ['Headway'],
      },
      {
        tag: 'button',
        className: 'app-header__settings',
        attrs: { type: 'button', 'aria-label': 'Settings', 'data-role': 'settings' },
        children: ['⚙'],
      },
    ],
  };
}

function viewPane(name: 'library' | 'book' | 'chapter' | 'modal-stack'): ShellNode {
  return {
    tag: 'section',
    className: `view view-${name}__pane`,
    attrs: { 'data-pane': name, 'aria-hidden': name === 'library' ? 'false' : 'true' },
  };
}

export function renderSpinner(): ShellNode {
  return {
    tag: 'div',
    className: 'spinner',
    attrs: { role: 'status', 'aria-label': 'Loading', hidden: '' },
  };
}

export function renderAppShell(): ShellNode {
  return {
    tag: 'div',
    className: 'app view-library',
    attrs: { 'data-view': 'library' },
    children: [
      header(),
      {
        tag: 'main',
        className: 'app-main',
        children: [
          viewPane('library'),
          viewPane('book'),
          viewPane('chapter'),
          viewPane('modal-stack'),
        ],
      },
      {
        tag: 'div',
        className: 'toast-container',
        attrs: { 'aria-live': 'polite', 'data-role': 'toast-container' },
      },
      renderSpinner(),
    ],
  };
}
