// Summary mode view (Sprint B / TB.5).
//
// Three render states — Loading, Error+Retry, Success — built as
// `ShellNode` trees and materialised via `buildElement`. All text flows
// through `createTextNode` (audit P2-#1 + AC #4 — no XSS).

import { loadSummary, type Summary } from '../ai/modes/summary';
import { getSecret } from '../data/secrets';
import type { Chapter } from '../lib/importers/types';
import { buildElement, type ShellNode } from './dom';
import { showToast } from './toast';

const DIFFICULTY_MAX = 5;

export function renderSummaryLoading(): ShellNode {
  return {
    tag: 'div',
    className: 'summary summary--loading',
    attrs: { role: 'status', 'aria-live': 'polite' },
    children: [
      { tag: 'div', className: 'summary__spinner', attrs: { 'aria-hidden': 'true' } },
      { tag: 'p', className: 'summary__loading-label', children: ['Generating summary…'] },
    ],
  };
}

export function renderSummaryError(message: string): ShellNode {
  return {
    tag: 'div',
    className: 'summary summary--error',
    attrs: { role: 'alert', 'aria-live': 'assertive' },
    children: [
      { tag: 'p', className: 'summary__error-message', children: [message] },
      {
        tag: 'button',
        className: 'summary__retry',
        attrs: { type: 'button', 'data-role': 'summary-retry' },
        children: ['Retry'],
      },
    ],
  };
}

function difficultyStars(level: number): string {
  const clamped = Math.max(0, Math.min(DIFFICULTY_MAX, Math.round(level)));
  return '★'.repeat(clamped) + '☆'.repeat(DIFFICULTY_MAX - clamped);
}

function summaryParagraphs(text: string): ShellNode[] {
  if (text.trim() === '') return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => ({
      tag: 'p',
      className: 'summary__paragraph',
      children: [p],
    }));
}

export function renderSummary(summary: Summary): ShellNode {
  return {
    tag: 'div',
    className: 'summary',
    children: [
      {
        tag: 'div',
        className: 'summary__meta',
        children: [
          {
            tag: 'span',
            className: 'summary__reading-time',
            attrs: { 'aria-label': `Reading time ${summary.readingTime} minutes` },
            children: [`${summary.readingTime} min read`],
          },
          { tag: 'span', className: 'summary__sep', attrs: { 'aria-hidden': 'true' }, children: ['·'] },
          {
            tag: 'span',
            className: 'summary__difficulty',
            attrs: {
              'aria-label': `Difficulty ${summary.difficulty} out of ${DIFFICULTY_MAX}`,
              'data-difficulty': String(summary.difficulty),
            },
            children: [difficultyStars(summary.difficulty)],
          },
        ],
      },
      {
        tag: 'div',
        className: 'summary__pills',
        children: summary.keyConcepts.map((concept) => ({
          tag: 'span',
          className: 'summary__pill',
          children: [concept],
        })),
      },
      {
        tag: 'div',
        className: 'summary__body',
        children: summaryParagraphs(summary.summary),
      },
    ],
  };
}

// --- orchestration --------------------------------------------------------

export interface ShowSummaryOptions {
  toastContainer: HTMLElement;
  /** Fires after a successful generation. Used by the chapter view to
   *  trigger a library refresh (so newly-written `chapter.difficulty`
   *  shows up as stars on the book card). */
  onAfterLoad?: (summary: Summary) => void | Promise<void>;
}

export async function showSummary(
  chapter: Chapter,
  pane: HTMLElement,
  options: ShowSummaryOptions,
): Promise<void> {
  const apiKey = getSecret('aiApiKey') ?? '';
  if (apiKey === '') {
    pane.replaceChildren(
      buildElement(
        renderSummaryError('No API key set. Open Settings → API key to add yours.'),
      ),
    );
    wireRetry(pane, chapter, options);
    return;
  }

  pane.replaceChildren(buildElement(renderSummaryLoading()));

  try {
    const summary = await loadSummary(chapter, apiKey);
    pane.replaceChildren(buildElement(renderSummary(summary)));
    if (options.onAfterLoad !== undefined) {
      await options.onAfterLoad(summary);
    }
  } catch (err) {
    const message = (err as Error).message ?? 'Summary generation failed';
    pane.replaceChildren(buildElement(renderSummaryError(message)));
    wireRetry(pane, chapter, options);
    showToast(options.toastContainer, `Summary failed: ${message}`, 'error');
  }
}

function wireRetry(
  pane: HTMLElement,
  chapter: Chapter,
  options: ShowSummaryOptions,
): void {
  const btn = pane.querySelector('.summary__retry') as HTMLElement | null;
  btn?.addEventListener('click', () => {
    void showSummary(chapter, pane, options);
  });
}
