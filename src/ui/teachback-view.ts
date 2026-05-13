// Teach-Back mode view (Sprint B / TB.8).
//
// Layout:
//   .teachback
//     .teachback__form        — label + textarea + inline validation + submit
//     .teachback__result-container — loading / error / result panel
//
// States are scoped: form stays visible while the result-container swaps
// between empty / loading / error / result panel. The pane-wide
// `renderTeachbackError` is reserved for the "no API key" empty-state.
//
// Cache UX (AC #3): on mount, `loadCachedTeachback` is consulted; if a
// prior attempt exists, the textarea is seeded with the previous text
// and the result panel is rendered immediately — no API call.
//
// Score tier colors (AC #2):
//   * low (0-39)  — red
//   * mid (40-69) — yellow
//   * high (70-100) — green
// The tier is exposed as `data-tier` on the score badge; the CSS owns
// the actual color, so unit tests can assert tier classification
// independently of styling.

import { evaluateTeachback, loadCachedTeachback } from '../ai/modes/teachback';
import type { TeachbackAttempt, TeachbackResult } from '../ai/modes/teachback';
import { getSecret } from '../data/secrets';
import type { Chapter } from '../lib/importers/types';
import { buildElement, type ShellNode } from './dom';
import { showToast } from './toast';

export type ScoreTier = 'low' | 'mid' | 'high';

export function scoreTier(score: number): ScoreTier {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

export function renderTeachback(chapter: Chapter, initialExplanation: string): ShellNode {
  return {
    tag: 'div',
    className: 'teachback',
    children: [
      {
        tag: 'div',
        className: 'teachback__form',
        children: [
          {
            tag: 'label',
            className: 'teachback__label',
            attrs: { 'data-role': 'teachback-label' },
            children: [`Explain what you learned about "${chapter.title}"`],
          },
          {
            tag: 'textarea',
            className: 'teachback__textarea',
            attrs: {
              'data-role': 'teachback-textarea',
              rows: '8',
              'aria-label': `Your explanation of ${chapter.title}`,
              spellcheck: 'true',
            },
            children: [initialExplanation],
          },
          {
            tag: 'p',
            className: 'teachback__validation',
            attrs: {
              'data-role': 'teachback-validation',
              role: 'alert',
              'aria-live': 'polite',
            },
          },
          {
            tag: 'button',
            className: 'teachback__submit',
            attrs: { type: 'button', 'data-role': 'teachback-submit' },
            children: ['Submit'],
          },
        ],
      },
      {
        tag: 'div',
        className: 'teachback__result-container',
        attrs: { 'data-role': 'teachback-result-container' },
      },
    ],
  };
}

export function renderTeachbackLoading(): ShellNode {
  return {
    tag: 'div',
    className: 'teachback teachback--loading',
    attrs: { role: 'status', 'aria-live': 'polite' },
    children: [
      { tag: 'div', className: 'teachback__spinner', attrs: { 'aria-hidden': 'true' } },
      { tag: 'p', className: 'teachback__loading-label', children: ['Evaluating…'] },
    ],
  };
}

export function renderTeachbackError(message: string): ShellNode {
  return {
    tag: 'div',
    className: 'teachback teachback--error',
    attrs: { role: 'alert', 'aria-live': 'assertive' },
    children: [
      { tag: 'p', className: 'teachback__error-message', children: [message] },
      {
        tag: 'button',
        className: 'teachback__retry',
        attrs: { type: 'button', 'data-role': 'teachback-retry' },
        children: ['Retry'],
      },
    ],
  };
}

function resultSection(title: string, items: string[], modifier: string): ShellNode {
  return {
    tag: 'section',
    className: `teachback__section teachback__section--${modifier}`,
    children: [
      { tag: 'h4', className: 'teachback__section-title', children: [title] },
      {
        tag: 'ul',
        className: 'teachback__list',
        children: items.map((item) => ({
          tag: 'li',
          className: 'teachback__item',
          children: [item],
        })),
      },
    ],
  };
}

export function renderTeachbackResult(result: TeachbackResult): ShellNode {
  const tier = scoreTier(result.score);
  return {
    tag: 'div',
    className: 'teachback__result',
    children: [
      {
        tag: 'div',
        className: `teachback__score teachback__score--${tier}`,
        attrs: {
          'data-tier': tier,
          'aria-label': `Score ${result.score} out of 100`,
        },
        children: [String(result.score)],
      },
      resultSection('Strengths', result.strengths, 'strengths'),
      resultSection('Gaps', result.gaps, 'gaps'),
      resultSection('Suggestions', result.suggestions, 'suggestions'),
    ],
  };
}

function renderResultLoading(): ShellNode {
  return {
    tag: 'div',
    className: 'teachback__result-loading',
    attrs: { role: 'status', 'aria-live': 'polite' },
    children: [
      { tag: 'div', className: 'teachback__spinner', attrs: { 'aria-hidden': 'true' } },
      { tag: 'p', className: 'teachback__loading-label', children: ['Evaluating…'] },
    ],
  };
}

function renderResultError(message: string): ShellNode {
  return {
    tag: 'div',
    className: 'teachback__result-error',
    attrs: { role: 'alert', 'aria-live': 'assertive' },
    children: [
      { tag: 'p', className: 'teachback__error-message', children: [message] },
      {
        tag: 'button',
        className: 'teachback__retry',
        attrs: { type: 'button', 'data-role': 'teachback-result-retry' },
        children: ['Retry'],
      },
    ],
  };
}

// --- orchestration --------------------------------------------------------

export interface ShowTeachbackOptions {
  toastContainer: HTMLElement;
}

function readExplanation(textarea: HTMLTextAreaElement): string {
  // The real DOM exposes the typed-in value via `.value`; the test stub
  // doesn't, so fall back to `.textContent` (matches settings-prompts).
  const valueProp = (textarea as unknown as { value?: unknown }).value;
  if (typeof valueProp === 'string') return valueProp;
  return textarea.textContent ?? '';
}

function setValidation(el: HTMLElement | null, message: string): void {
  if (el === null) return;
  el.textContent = message;
}

function wireSubmit(
  pane: HTMLElement,
  chapter: Chapter,
  apiKey: string,
  options: ShowTeachbackOptions,
): void {
  const submit = pane.querySelector('[data-role="teachback-submit"]') as HTMLElement | null;
  const textarea = pane.querySelector(
    '[data-role="teachback-textarea"]',
  ) as HTMLTextAreaElement | null;
  const validation = pane.querySelector(
    '[data-role="teachback-validation"]',
  ) as HTMLElement | null;
  const resultContainer = pane.querySelector(
    '[data-role="teachback-result-container"]',
  ) as HTMLElement | null;
  if (submit === null || textarea === null || resultContainer === null) return;

  const runEvaluation = (explanation: string): void => {
    resultContainer.replaceChildren(buildElement(renderResultLoading()));
    void evaluateTeachback(chapter, explanation, apiKey).then(
      (result) => {
        resultContainer.replaceChildren(buildElement(renderTeachbackResult(result)));
      },
      (err: Error) => {
        const message = err.message ?? 'Teach-back evaluation failed';
        resultContainer.replaceChildren(buildElement(renderResultError(message)));
        showToast(options.toastContainer, `Teach-back failed: ${message}`, 'error');
        const retryBtn = resultContainer.querySelector(
          '[data-role="teachback-result-retry"]',
        ) as HTMLElement | null;
        retryBtn?.addEventListener('click', () => runEvaluation(explanation));
      },
    );
  };

  submit.addEventListener('click', () => {
    const explanation = readExplanation(textarea);
    if (explanation.trim() === '') {
      setValidation(validation, 'Please enter your explanation before submitting.');
      return;
    }
    setValidation(validation, '');
    runEvaluation(explanation);
  });
}

function mountCached(pane: HTMLElement, attempt: TeachbackAttempt): void {
  const resultContainer = pane.querySelector(
    '[data-role="teachback-result-container"]',
  ) as HTMLElement | null;
  if (resultContainer === null) return;
  resultContainer.replaceChildren(buildElement(renderTeachbackResult(attempt.result)));
}

export async function showTeachback(
  chapter: Chapter,
  pane: HTMLElement,
  options: ShowTeachbackOptions,
): Promise<void> {
  const apiKey = getSecret('aiApiKey') ?? '';
  if (apiKey === '') {
    pane.replaceChildren(
      buildElement(
        renderTeachbackError('No API key set. Open Settings → API key to add yours.'),
      ),
    );
    wireRetry(pane, chapter, options);
    return;
  }

  const cached = await loadCachedTeachback(chapter.id);
  pane.replaceChildren(buildElement(renderTeachback(chapter, cached?.explanation ?? '')));
  if (cached !== undefined) mountCached(pane, cached);
  wireSubmit(pane, chapter, apiKey, options);
}

function wireRetry(
  pane: HTMLElement,
  chapter: Chapter,
  options: ShowTeachbackOptions,
): void {
  const btn = pane.querySelector('.teachback__retry') as HTMLElement | null;
  btn?.addEventListener('click', () => {
    void showTeachback(chapter, pane, options);
  });
}
