import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  renderFlashcards,
  renderFlashcardsError,
  renderFlashcardsLoading,
  showFlashcards,
} from './flashcards-view';
import { clearAllSecrets, setSecret } from '../data/secrets';
import { closeDb } from '../data/db';
import { asHTMLElement, makeDoc } from '../test/dom-stub';
import type { Chapter } from '../lib/importers/types';
import type { Flashcard } from '../ai/modes/flashcards';

const SAMPLE_CARDS: Flashcard[] = [
  { front: 'Q1', back: 'A1' },
  { front: 'Q2', back: 'A2' },
  { front: 'Q3', back: 'A3' },
  { front: 'Q4', back: 'A4' },
  { front: 'Q5', back: 'A5' },
];

function chapter(): Chapter {
  return {
    id: 'book_1_ch_0',
    bookId: 'book_1',
    index: 0,
    title: 'Forces of Nature',
    content: 'Some body text.',
  };
}

function anthropicResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_x',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  clearAllSecrets();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await closeDb();
  clearAllSecrets();
  vi.restoreAllMocks();
});

describe('renderFlashcardsLoading', () => {
  it('renders spinner + aria-live polite label', () => {
    const json = JSON.stringify(renderFlashcardsLoading());
    expect(json).toContain('flashcards--loading');
    expect(json).toContain('"aria-live":"polite"');
    expect(json).toContain('Generating flashcards');
  });
});

describe('renderFlashcardsError', () => {
  it('renders the message + Retry button with role=alert', () => {
    const json = JSON.stringify(renderFlashcardsError('boom'));
    expect(json).toContain('flashcards--error');
    expect(json).toContain('boom');
    expect(json).toContain('"data-role":"flashcards-retry"');
    expect(json).toContain('"role":"alert"');
    expect(json).toContain('"aria-live":"assertive"');
  });
});

describe('renderFlashcards', () => {
  it('renders one card at a time with front + back faces (AC #1)', () => {
    const json = JSON.stringify(renderFlashcards(SAMPLE_CARDS, 0));
    expect(json).toContain('flashcards__card');
    expect(json).toContain('flashcards__face--front');
    expect(json).toContain('flashcards__face--back');
    // First card front + back are visible in the DOM tree (both faces
    // are rendered, the flip is purely CSS).
    expect(json).toContain('Q1');
    expect(json).toContain('A1');
    // Other cards' fronts NOT rendered (single-card-at-a-time invariant).
    expect(json).not.toContain('Q2');
    expect(json).not.toContain('A2');
  });

  it('renders the counter "1 / N"', () => {
    const json = JSON.stringify(renderFlashcards(SAMPLE_CARDS, 0));
    expect(json).toContain('1 / 5');
  });

  it('renders Prev / Next / More cards controls', () => {
    const json = JSON.stringify(renderFlashcards(SAMPLE_CARDS, 0));
    expect(json).toContain('"data-role":"flashcards-prev"');
    expect(json).toContain('"data-role":"flashcards-next"');
    expect(json).toContain('"data-role":"flashcards-more"');
  });

  it('disables Prev at index 0 and Next at last index', () => {
    const first = JSON.stringify(renderFlashcards(SAMPLE_CARDS, 0));
    expect(first).toMatch(/"data-role":"flashcards-prev","disabled":"true"|"disabled":"true"[^}]*"data-role":"flashcards-prev"/);
    const last = JSON.stringify(renderFlashcards(SAMPLE_CARDS, 4));
    expect(last).toContain('"data-role":"flashcards-next"');
    expect(last).toMatch(/"disabled":"true"/);
  });
});

describe('showFlashcards', () => {
  function makeContainer() {
    const doc = makeDoc();
    const pane = doc.createElement('div');
    const toastContainer = doc.createElement('div');
    return { doc, pane, toastContainer };
  }

  it('renders the error empty-state with Retry when no API key is set', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const node = pane.children[0]!;
    expect(node.className).toContain('flashcards--error');
    expect(node.querySelector('.flashcards__retry')).not.toBeNull();
  });

  it('renders success after a successful fetch', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards: SAMPLE_CARDS }),
    );

    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    expect(root.className).toContain('flashcards');
    expect(root.querySelector('.flashcards__card')).not.toBeNull();
    const counter = root.querySelector('.flashcards__counter');
    expect(counter?.textContent).toBe('1 / 5');
  });

  it('flips the card on click (toggles flipped class — AC #2 mechanism)', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards: SAMPLE_CARDS }),
    );

    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const card = pane.children[0]!.querySelector('.flashcards__card')!;
    expect(card.classList.contains('flashcards__card--flipped')).toBe(false);
    card.dispatchEvent('click');
    expect(card.classList.contains('flashcards__card--flipped')).toBe(true);
    card.dispatchEvent('click');
    expect(card.classList.contains('flashcards__card--flipped')).toBe(false);
  });

  it('advances on Next and goes back on Prev', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards: SAMPLE_CARDS }),
    );

    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const next = root.querySelector('[data-role="flashcards-next"]')!;
    const prev = root.querySelector('[data-role="flashcards-prev"]')!;
    const counter = root.querySelector('.flashcards__counter')!;
    const frontFace = root.querySelector('.flashcards__face--front')!;

    expect(counter.textContent).toBe('1 / 5');
    expect(frontFace.textContent).toBe('Q1');

    next.dispatchEvent('click');
    expect(counter.textContent).toBe('2 / 5');
    expect(frontFace.textContent).toBe('Q2');

    next.dispatchEvent('click');
    expect(counter.textContent).toBe('3 / 5');

    prev.dispatchEvent('click');
    expect(counter.textContent).toBe('2 / 5');
    expect(frontFace.textContent).toBe('Q2');
  });

  it('resets the flipped state when navigating', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards: SAMPLE_CARDS }),
    );

    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const card = root.querySelector('.flashcards__card')!;
    const next = root.querySelector('[data-role="flashcards-next"]')!;

    card.dispatchEvent('click');
    expect(card.classList.contains('flashcards__card--flipped')).toBe(true);
    next.dispatchEvent('click');
    expect(card.classList.contains('flashcards__card--flipped')).toBe(false);
  });

  it('appends new cards via More cards and updates the counter (AC #3)', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(anthropicResponse({ cards: SAMPLE_CARDS }));
    fetchSpy.mockResolvedValueOnce(
      anthropicResponse({
        cards: [
          { front: 'Q6', back: 'A6' },
          { front: 'Q7', back: 'A7' },
        ],
      }),
    );

    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const more = root.querySelector('[data-role="flashcards-more"]')!;
    more.dispatchEvent('click');
    await vi.waitFor(() => {
      const c = pane.children[0]!.querySelector('.flashcards__counter');
      if (c?.textContent !== '1 / 7') throw new Error('not yet');
    });
  });

  it('renders error empty-state on API failure', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'down' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    expect(pane.children[0]!.className).toContain('flashcards--error');
    expect(pane.children[0]!.querySelector('.flashcards__retry')).not.toBeNull();
  });

  it('shows an error toast when the API returns a 500 (TB.12 AC #1, #3)', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    // SDK retries 5xx; mockResolvedValue (not Once) makes every retry fail.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'boom' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const toast = toastContainer.children[0];
    expect(toast).toBeDefined();
    expect(toast!.className).toContain('toast--error');
  }, 10_000);

  it('retry button re-runs loadFlashcards using the same cache key (TB.12 AC #2, #4)', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    // 400 is NOT retried by the SDK — deterministic one-call failure.
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    fetchSpy.mockResolvedValueOnce(anthropicResponse({ cards: SAMPLE_CARDS }));

    await showFlashcards(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    expect(pane.children[0]!.className).toContain('flashcards--error');

    const retry = pane.children[0]!.querySelector('.flashcards__retry')!;
    retry.dispatchEvent('click');
    await vi.waitFor(() => {
      const card = pane.children[0]!.querySelector('.flashcards__card');
      if (card === null) throw new Error('not yet success');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const { getCachedGeneration } = await import('../lib/cache');
    const cached = await getCachedGeneration<{ front: string; back: string }[]>(
      'flashcards',
      chapter().id,
    );
    expect(cached).toBeDefined();
  });
});
