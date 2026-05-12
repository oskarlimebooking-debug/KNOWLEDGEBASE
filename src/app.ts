// App entry — assembles the shell, mounts it on the page, and wires
// the structural event handlers (header back button, settings click,
// library Add Book + book-card clicks, book detail chapter clicks +
// delete cascade).
//
// Audit P2-#1 (phase-A): the shell is constructed via the typed data
// tree in `src/ui/shell.ts` and materialised by `buildElement` in
// `src/ui/dom.ts` — no `innerHTML` anywhere in the render path.

import { setOnBookDeleted, showBookDetail } from './ui/book-detail';
import { buildElement } from './ui/dom';
import { refreshLibrary, setBookClickHandler } from './ui/library';
import { openSettings } from './ui/settings';
import { renderAppShell } from './ui/shell';
import { backView, setView } from './ui/view';

type SettingsHandler = () => void;

let settingsHandler: SettingsHandler | null = null;

export function setSettingsHandler(handler: SettingsHandler): void {
  settingsHandler = handler;
}

function defaultSettingsHandler(root: HTMLElement): SettingsHandler {
  return () => {
    const stack = root.querySelector('.view-modal-stack__pane') as HTMLElement | null;
    if (!stack) return;
    void openSettings(stack);
  };
}

function wireHeader(root: HTMLElement): void {
  const back = root.querySelector('.app-header__back') as HTMLElement | null;
  const settings = root.querySelector('.app-header__settings') as HTMLElement | null;
  if (back) {
    back.addEventListener('click', () => {
      backView(root);
    });
  }
  if (settings) {
    settings.addEventListener('click', () => {
      if (settingsHandler !== null) settingsHandler();
    });
  }
}

export function mountApp(root: HTMLElement | null): void {
  if (!root) {
    throw new Error('mountApp: #app root element not found');
  }
  const shell = buildElement(renderAppShell());
  root.replaceChildren(shell);
  if (settingsHandler === null) settingsHandler = defaultSettingsHandler(shell);
  wireHeader(shell);

  const libraryPane = shell.querySelector('.view-library__pane') as HTMLElement | null;
  const bookPane = shell.querySelector('.view-book__pane') as HTMLElement | null;
  const modalStack = shell.querySelector('.view-modal-stack__pane') as HTMLElement | null;
  const toastContainer = shell.querySelector('.toast-container') as HTMLElement | null;

  if (libraryPane !== null && bookPane !== null && modalStack !== null && toastContainer !== null) {
    setBookClickHandler((bookId) => {
      void showBookDetail(bookId, bookPane, toastContainer, modalStack);
    });
    setOnBookDeleted(async () => {
      setView(shell, 'library');
      await refreshLibrary(libraryPane, toastContainer);
    });
    void refreshLibrary(libraryPane, toastContainer).catch((err: Error) => {
      console.error('[library] refresh failed', err);
    });
  }
}
