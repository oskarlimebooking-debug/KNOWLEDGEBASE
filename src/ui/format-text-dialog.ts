// Format Text dialog (Sprint B / TB.10).
//
// Modal with two options:
//   * Format current chapter   — single call, brief loading state
//   * Format all chapters      — sequential per-chapter run with a
//                                live progress bar; per-chapter failures
//                                are surfaced in a tally at the end.
//
// Mounts into the `.view-modal-stack__pane` container. Closes on
// success or Cancel. Escape closes only when not currently running.

import { formatAllChapters, formatChapter } from '../ai/modes/format-text';
import { dbGetByIndex } from '../data/db';
import { STORE_CHAPTERS } from '../data/schema';
import { getSecret } from '../data/secrets';
import type { Chapter } from '../lib/importers/types';
import { buildElement, type ShellNode } from './dom';
import { showToast } from './toast';

export interface FormatTextDialogOptions {
  currentChapter: Chapter;
  toastContainer: HTMLElement;
  /** Fires after at least one chapter has been formatted. The chapter
   *  view subscribes to this so it can re-render its body from the
   *  freshly-written `formattedHtml`. */
  onAfterFormat?: () => void | Promise<void>;
}

export interface FormatTextDialogHandle {
  element: HTMLElement;
  close: () => void;
}

function chooserTree(): ShellNode {
  return {
    tag: 'div',
    className: 'modal',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'format-title' },
    children: [
      {
        tag: 'div',
        className: 'modal__header',
        children: [
          { tag: 'h2', className: 'modal__title', attrs: { id: 'format-title' }, children: ['Format Text'] },
          {
            tag: 'button',
            className: 'modal__close',
            attrs: { type: 'button', 'aria-label': 'Close', 'data-role': 'cancel' },
            children: ['×'],
          },
        ],
      },
      {
        tag: 'div',
        className: 'modal__body',
        children: [
          {
            tag: 'p',
            className: 'modal__message',
            children: [
              'Reformat chapter text into semantic HTML (headings, paragraphs, lists). The Read view will prefer the formatted version.',
            ],
          },
          {
            tag: 'div',
            className: 'modal__actions modal__actions--vertical',
            children: [
              {
                tag: 'button',
                className: 'modal__action',
                attrs: { type: 'button', 'data-role': 'format-current' },
                children: ['Format current chapter'],
              },
              {
                tag: 'button',
                className: 'modal__action modal__action--secondary',
                attrs: { type: 'button', 'data-role': 'format-all' },
                children: ['Format all chapters'],
              },
            ],
          },
          {
            tag: 'div',
            className: 'format-text__status',
            attrs: { 'data-role': 'status', hidden: '' },
            children: [],
          },
        ],
      },
    ],
  };
}

function progressTree(currentIndex: number, total: number): ShellNode {
  const pct = total === 0 ? 0 : Math.round(((currentIndex + 1) / total) * 100);
  return {
    tag: 'div',
    className: 'format-text__progress',
    attrs: { role: 'status', 'aria-live': 'polite' },
    children: [
      {
        tag: 'p',
        className: 'format-text__progress-label',
        children: [`Chapter ${currentIndex + 1} of ${total}`],
      },
      {
        tag: 'div',
        className: 'format-text__progress-bar',
        attrs: { role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' },
        children: [
          {
            tag: 'div',
            className: 'format-text__progress-fill',
            attrs: { style: `width:${pct}%` },
          },
        ],
      },
    ],
  };
}

function inlineLoading(label: string): ShellNode {
  return {
    tag: 'div',
    className: 'format-text__loading',
    attrs: { role: 'status', 'aria-live': 'polite' },
    children: [
      { tag: 'div', className: 'format-text__spinner', attrs: { 'aria-hidden': 'true' } },
      { tag: 'p', className: 'format-text__loading-label', children: [label] },
    ],
  };
}

export function openFormatTextDialog(
  stack: HTMLElement,
  opts: FormatTextDialogOptions,
  doc: Document = document,
): FormatTextDialogHandle {
  const backdrop = doc.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = buildElement(chooserTree(), doc);
  backdrop.appendChild(modal);
  stack.appendChild(backdrop);
  stack.setAttribute('aria-hidden', 'false');

  let closed = false;
  let running = false;
  const close = (): void => {
    if (closed || running) return;
    closed = true;
    backdrop.remove();
    if (stack.children.length === 0) stack.setAttribute('aria-hidden', 'true');
    doc.removeEventListener('keydown', escListener);
  };
  const escListener = (e: Event): void => {
    if ((e as KeyboardEvent).key === 'Escape') close();
  };
  doc.addEventListener('keydown', escListener);

  const cancelBtn = modal.querySelector('[data-role="cancel"]') as HTMLElement | null;
  const formatCurrent = modal.querySelector('[data-role="format-current"]') as HTMLElement | null;
  const formatAll = modal.querySelector('[data-role="format-all"]') as HTMLElement | null;
  const statusEl = modal.querySelector('[data-role="status"]') as HTMLElement | null;

  cancelBtn?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const apiKey = getSecret('aiApiKey') ?? '';

  const showStatus = (node: ShellNode): void => {
    if (statusEl === null) return;
    statusEl.removeAttribute('hidden');
    statusEl.replaceChildren(buildElement(node, doc));
  };

  const lock = (): void => {
    running = true;
    formatCurrent?.setAttribute('disabled', 'true');
    formatAll?.setAttribute('disabled', 'true');
    cancelBtn?.setAttribute('disabled', 'true');
  };
  const unlock = (): void => {
    running = false;
    formatCurrent?.removeAttribute('disabled');
    formatAll?.removeAttribute('disabled');
    cancelBtn?.removeAttribute('disabled');
  };

  formatCurrent?.addEventListener('click', () => {
    if (apiKey === '') {
      showToast(opts.toastContainer, 'No API key set. Open Settings → API key first.', 'error');
      return;
    }
    lock();
    showStatus(inlineLoading('Formatting chapter…'));
    void formatChapter(opts.currentChapter, apiKey).then(
      async () => {
        unlock();
        showToast(opts.toastContainer, 'Chapter formatted.', 'success');
        if (opts.onAfterFormat !== undefined) await opts.onAfterFormat();
        running = false;
        close();
      },
      (err: Error) => {
        unlock();
        showToast(opts.toastContainer, `Format failed: ${err.message}`, 'error');
      },
    );
  });

  formatAll?.addEventListener('click', () => {
    if (apiKey === '') {
      showToast(opts.toastContainer, 'No API key set. Open Settings → API key first.', 'error');
      return;
    }
    lock();
    void runFormatAll(opts.currentChapter.bookId, apiKey, showStatus).then(
      async (result) => {
        unlock();
        const msg =
          result.errored === 0
            ? `Formatted ${result.total} chapter${result.total === 1 ? '' : 's'}.`
            : `Formatted ${result.total - result.errored}/${result.total} (${result.errored} failed).`;
        showToast(opts.toastContainer, msg, result.errored === 0 ? 'success' : 'warn');
        if (opts.onAfterFormat !== undefined) await opts.onAfterFormat();
        running = false;
        close();
      },
      (err: Error) => {
        unlock();
        showToast(opts.toastContainer, `Format all failed: ${err.message}`, 'error');
      },
    );
  });

  return { element: modal, close };
}

async function runFormatAll(
  bookId: string,
  apiKey: string,
  showStatus: (n: ShellNode) => void,
): Promise<{ total: number; errored: number }> {
  const chapters = await dbGetByIndex<Chapter>(STORE_CHAPTERS, 'bookId', bookId);
  chapters.sort((a, b) => a.index - b.index);
  if (chapters.length === 0) {
    return { total: 0, errored: 0 };
  }
  showStatus(progressTree(0, chapters.length));
  const result = await formatAllChapters(chapters, apiKey, (p) => {
    showStatus(progressTree(p.currentIndex, p.total));
  });
  return { total: chapters.length, errored: result.errored.length };
}
