// Flashcards mode view (Sprint B / TB.7).
//
// States: Loading, Error+Retry, Success.  Success renders a single card
// at a time (front + back faces both in the DOM; the CSS 3D-flip is
// purely a transform on the card element, so click-to-flip stays at
// 60fps even on mid-tier mobile — AC #2). Prev / Next clamp at the
// boundaries (disabled state at index 0 / last). "More cards" calls
// `appendFlashcards` which dedupes by front before writeback — AC #3.

import { appendFlashcards, loadFlashcards, type Flashcard } from '../ai/modes/flashcards';
import { getSecret } from '../data/secrets';
import type { Chapter } from '../lib/importers/types';
import { buildElement, type ShellNode } from './dom';
import { showToast } from './toast';

interface FlashcardsState {
  cards: Flashcard[];
  index: number;
}

export function renderFlashcardsLoading(): ShellNode {
  return {
    tag: 'div',
    className: 'flashcards flashcards--loading',
    attrs: { role: 'status', 'aria-live': 'polite' },
    children: [
      { tag: 'div', className: 'flashcards__spinner', attrs: { 'aria-hidden': 'true' } },
      {
        tag: 'p',
        className: 'flashcards__loading-label',
        children: ['Generating flashcards…'],
      },
    ],
  };
}

export function renderFlashcardsError(message: string): ShellNode {
  return {
    tag: 'div',
    className: 'flashcards flashcards--error',
    attrs: { role: 'alert', 'aria-live': 'assertive' },
    children: [
      { tag: 'p', className: 'flashcards__error-message', children: [message] },
      {
        tag: 'button',
        className: 'flashcards__retry',
        attrs: { type: 'button', 'data-role': 'flashcards-retry' },
        children: ['Retry'],
      },
    ],
  };
}

function navButton(role: string, label: string, disabled: boolean): ShellNode {
  const attrs: Record<string, string> = { type: 'button', 'data-role': role };
  if (disabled) {
    attrs.disabled = 'true';
    attrs['aria-disabled'] = 'true';
  }
  return { tag: 'button', className: 'flashcards__nav-btn', attrs, children: [label] };
}

export function renderFlashcards(cards: Flashcard[], index: number): ShellNode {
  const card = cards[index] as Flashcard;
  const prevDisabled = index <= 0;
  const nextDisabled = index >= cards.length - 1;

  return {
    tag: 'div',
    className: 'flashcards',
    children: [
      {
        tag: 'div',
        className: 'flashcards__counter',
        attrs: { 'aria-live': 'polite' },
        children: [`${index + 1} / ${cards.length}`],
      },
      {
        tag: 'div',
        className: 'flashcards__stage',
        children: [
          {
            tag: 'button',
            className: 'flashcards__card',
            attrs: {
              type: 'button',
              'data-role': 'flashcards-flip',
              'aria-pressed': 'false',
              'aria-label': 'Flip card',
            },
            children: [
              {
                tag: 'div',
                className: 'flashcards__face flashcards__face--front',
                children: [card.front],
              },
              {
                tag: 'div',
                className: 'flashcards__face flashcards__face--back',
                children: [card.back],
              },
            ],
          },
        ],
      },
      {
        tag: 'div',
        className: 'flashcards__nav',
        children: [
          navButton('flashcards-prev', '‹ Previous', prevDisabled),
          navButton('flashcards-more', 'More cards', false),
          navButton('flashcards-next', 'Next ›', nextDisabled),
        ],
      },
    ],
  };
}

// --- orchestration --------------------------------------------------------

export interface ShowFlashcardsOptions {
  toastContainer: HTMLElement;
}

export async function showFlashcards(
  chapter: Chapter,
  pane: HTMLElement,
  options: ShowFlashcardsOptions,
): Promise<void> {
  const apiKey = getSecret('aiApiKey') ?? '';
  if (apiKey === '') {
    pane.replaceChildren(
      buildElement(
        renderFlashcardsError('No API key set. Open Settings → API key to add yours.'),
      ),
    );
    wireRetry(pane, chapter, options);
    return;
  }

  pane.replaceChildren(buildElement(renderFlashcardsLoading()));

  try {
    const cards = await loadFlashcards(chapter, apiKey);
    const state: FlashcardsState = { cards, index: 0 };
    mountSuccess(pane, chapter, state, options);
  } catch (err) {
    const message = (err as Error).message ?? 'Flashcards generation failed';
    pane.replaceChildren(buildElement(renderFlashcardsError(message)));
    wireRetry(pane, chapter, options);
    showToast(options.toastContainer, `Flashcards failed: ${message}`, 'error');
  }
}

function mountSuccess(
  pane: HTMLElement,
  chapter: Chapter,
  state: FlashcardsState,
  options: ShowFlashcardsOptions,
): void {
  pane.replaceChildren(buildElement(renderFlashcards(state.cards, state.index)));
  wireSuccess(pane, chapter, state, options);
}

function updateCardInPlace(pane: HTMLElement, state: FlashcardsState): void {
  const card = state.cards[state.index] as Flashcard;
  const cardEl = pane.querySelector('.flashcards__card') as HTMLElement | null;
  const front = pane.querySelector('.flashcards__face--front') as HTMLElement | null;
  const back = pane.querySelector('.flashcards__face--back') as HTMLElement | null;
  const counter = pane.querySelector('.flashcards__counter') as HTMLElement | null;
  if (front !== null) front.textContent = card.front;
  if (back !== null) back.textContent = card.back;
  if (counter !== null) counter.textContent = `${state.index + 1} / ${state.cards.length}`;
  if (cardEl !== null) {
    cardEl.classList.remove('flashcards__card--flipped');
    cardEl.setAttribute('aria-pressed', 'false');
  }
  updateNavDisabled(pane, state);
}

function updateNavDisabled(pane: HTMLElement, state: FlashcardsState): void {
  const prev = pane.querySelector('[data-role="flashcards-prev"]') as HTMLElement | null;
  const next = pane.querySelector('[data-role="flashcards-next"]') as HTMLElement | null;
  setDisabled(prev, state.index <= 0);
  setDisabled(next, state.index >= state.cards.length - 1);
}

function setDisabled(el: HTMLElement | null, disabled: boolean): void {
  if (el === null) return;
  if (disabled) {
    el.setAttribute('disabled', 'true');
    el.setAttribute('aria-disabled', 'true');
  } else {
    el.removeAttribute('disabled');
    el.removeAttribute('aria-disabled');
  }
}

function wireSuccess(
  pane: HTMLElement,
  chapter: Chapter,
  state: FlashcardsState,
  options: ShowFlashcardsOptions,
): void {
  const cardEl = pane.querySelector('.flashcards__card') as HTMLElement | null;
  const prev = pane.querySelector('[data-role="flashcards-prev"]') as HTMLElement | null;
  const next = pane.querySelector('[data-role="flashcards-next"]') as HTMLElement | null;
  const more = pane.querySelector('[data-role="flashcards-more"]') as HTMLElement | null;

  cardEl?.addEventListener('click', () => {
    if (cardEl.classList.contains('flashcards__card--flipped')) {
      cardEl.classList.remove('flashcards__card--flipped');
      cardEl.setAttribute('aria-pressed', 'false');
    } else {
      cardEl.classList.add('flashcards__card--flipped');
      cardEl.setAttribute('aria-pressed', 'true');
    }
  });

  prev?.addEventListener('click', () => {
    if (state.index <= 0) return;
    state.index -= 1;
    updateCardInPlace(pane, state);
  });

  next?.addEventListener('click', () => {
    if (state.index >= state.cards.length - 1) return;
    state.index += 1;
    updateCardInPlace(pane, state);
  });

  more?.addEventListener('click', () => {
    const apiKey = getSecret('aiApiKey') ?? '';
    if (apiKey === '') return;
    setDisabled(more, true);
    void appendFlashcards(chapter, apiKey).then(
      (merged) => {
        state.cards = merged;
        // Keep the user on their current card if it still exists; clamp
        // otherwise.  Merge only ever appends, so the current index is
        // always valid — but clamp anyway as a safety net.
        if (state.index >= merged.length) state.index = merged.length - 1;
        updateCardInPlace(pane, state);
        setDisabled(more, false);
      },
      (err: Error) => {
        setDisabled(more, false);
        showToast(options.toastContainer, `More cards failed: ${err.message}`, 'error');
      },
    );
  });
}

function wireRetry(
  pane: HTMLElement,
  chapter: Chapter,
  options: ShowFlashcardsOptions,
): void {
  const btn = pane.querySelector('.flashcards__retry') as HTMLElement | null;
  btn?.addEventListener('click', () => {
    void showFlashcards(chapter, pane, options);
  });
}
