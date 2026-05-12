// Settings modal.
//
// Two sections: Reading (WPM input, 50-1000) and Data (Export All Data
// button). Open via the header gear (wired in src/app.ts). Mounted into
// the `.view-modal-stack__pane` container which CSS shows when
// `aria-hidden='false'`.

import { getSetting, setSetting } from '../data/db';
import { downloadAsJson, exportAllData } from '../lib/export';
import { buildElement, type ShellNode } from './dom';

export const WPM_MIN = 50;
export const WPM_MAX = 1000;
export const WPM_DEFAULT = 250;

export type WpmValidation =
  | { ok: true; value: number }
  | { ok: false; error: string };

export function validateWpm(raw: string): WpmValidation {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, error: 'Reading speed is required.' };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: 'Must be a whole number.' };
  }
  if (n < WPM_MIN || n > WPM_MAX) {
    return { ok: false, error: `Must be between ${WPM_MIN} and ${WPM_MAX}.` };
  }
  return { ok: true, value: n };
}

function settingsBody(wpm: number): ShellNode {
  return {
    tag: 'div',
    className: 'settings',
    children: [
      {
        tag: 'section',
        className: 'settings__section',
        children: [
          { tag: 'h3', className: 'settings__heading', children: ['Reading'] },
          {
            tag: 'label',
            className: 'settings__field',
            children: [
              { tag: 'span', className: 'settings__label', children: ['Reading speed (words/min)'] },
              {
                tag: 'input',
                className: 'settings__input',
                attrs: {
                  type: 'number',
                  name: 'wpm',
                  min: String(WPM_MIN),
                  max: String(WPM_MAX),
                  step: '10',
                  value: String(wpm),
                  inputmode: 'numeric',
                },
              },
              { tag: 'p', className: 'settings__hint', children: ['Used to estimate chapter read time.'] },
              {
                tag: 'p',
                className: 'settings__error',
                attrs: { role: 'alert', 'aria-live': 'polite', hidden: '' },
              },
            ],
          },
        ],
      },
      {
        tag: 'section',
        className: 'settings__section',
        children: [
          { tag: 'h3', className: 'settings__heading', children: ['Data'] },
          {
            tag: 'button',
            className: 'settings__action',
            attrs: { type: 'button', 'data-role': 'export' },
            children: ['Export All Data'],
          },
          {
            tag: 'p',
            className: 'settings__hint',
            children: ['Downloads every book, chapter, and progress row as JSON.'],
          },
        ],
      },
    ],
  };
}

export interface SettingsHandle {
  element: HTMLElement;
  close: () => void;
}

function buildModal(wpm: number, doc: Document): HTMLElement {
  const tree: ShellNode = {
    tag: 'div',
    className: 'modal',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' },
    children: [
      {
        tag: 'div',
        className: 'modal__header',
        children: [
          { tag: 'h2', className: 'modal__title', attrs: { id: 'settings-title' }, children: ['Settings'] },
          {
            tag: 'button',
            className: 'modal__close',
            attrs: { type: 'button', 'aria-label': 'Close settings' },
            children: ['×'],
          },
        ],
      },
      { tag: 'div', className: 'modal__body', children: [settingsBody(wpm)] },
    ],
  };
  return buildElement(tree, doc);
}

function wireWpmInput(modal: HTMLElement): void {
  const input = modal.querySelector('.settings__input') as HTMLInputElement | null;
  const error = modal.querySelector('.settings__error') as HTMLElement | null;
  if (!input || !error) return;
  const onChange = (): void => {
    const result = validateWpm(input.value);
    if (!result.ok) {
      error.textContent = result.error;
      error.removeAttribute('hidden');
      return;
    }
    error.setAttribute('hidden', '');
    error.textContent = '';
    void setSetting('readingSpeed', result.value);
  };
  input.addEventListener('input', onChange);
  input.addEventListener('change', onChange);
}

function wireExport(modal: HTMLElement, doc: Document): void {
  const btn = modal.querySelector('.settings__action') as HTMLElement | null;
  if (!btn) return;
  btn.addEventListener('click', () => {
    void exportAllData().then((payload) => downloadAsJson(payload, doc));
  });
}

export async function openSettings(
  stack: HTMLElement,
  doc: Document = document,
): Promise<SettingsHandle> {
  const wpm = (await getSetting<number>('readingSpeed')) ?? WPM_DEFAULT;
  const backdrop = doc.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = buildModal(wpm, doc);
  backdrop.appendChild(modal);
  stack.appendChild(backdrop);
  stack.setAttribute('aria-hidden', 'false');

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    if (stack.children.length === 0) stack.setAttribute('aria-hidden', 'true');
    doc.removeEventListener('keydown', escListener);
  };
  const escListener = (e: Event): void => {
    if ((e as KeyboardEvent).key === 'Escape') close();
  };

  const closeBtn = modal.querySelector('.modal__close') as HTMLElement | null;
  closeBtn?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  doc.addEventListener('keydown', escListener);

  wireWpmInput(modal);
  wireExport(modal, doc);

  return { element: modal, close };
}
