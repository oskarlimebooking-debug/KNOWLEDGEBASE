import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { showQuiz } from './quiz-view';
import { closeDb, dbPut } from '../data/db';
import { STORE_CHAPTERS } from '../data/schema';
import { clearAllSecrets, setSecret } from '../data/secrets';
import { recordQuizAttempt } from '../lib/quiz-scores';
import { asHTMLElement, makeDoc } from '../test/dom-stub';
import type { Chapter } from '../lib/importers/types';

function chapter(): Chapter {
  return {
    id: 'book_1_ch_0',
    bookId: 'book_1',
    index: 0,
    title: 'Forces of Nature',
    content: 'Some body text.',
  };
}

function makeContainer() {
  const doc = makeDoc();
  const pane = doc.createElement('div');
  const toastContainer = doc.createElement('div');
  vi.stubGlobal('document', doc);
  return { doc, pane, toastContainer };
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

describe('showQuiz — hub state', () => {
  it('renders the no-attempts hub with a Start button', async () => {
    const { pane, toastContainer } = makeContainer();
    await dbPut(STORE_CHAPTERS, chapter());
    await showQuiz(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const hub = pane.children[0]!;
    expect(hub.className).toContain('quiz--hub');
    expect(hub.querySelector('.quiz__btn[data-role="start"]')).not.toBeNull();
    expect(hub.querySelector('.quiz__btn[data-role="retake-wrong"]')).toBeNull();
    expect(hub.querySelector('.quiz__btn[data-role="more"]')).toBeNull();
    expect(hub.querySelector('.quiz__btn[data-role="regenerate"]')).toBeNull();
  });

  it('shows best score + attempt count once attempts exist', async () => {
    const { pane, toastContainer } = makeContainer();
    await dbPut(STORE_CHAPTERS, chapter());
    await recordQuizAttempt('book_1_ch_0', {
      date: '2026-05-13T00:00:00Z',
      percent: 75,
      correctCount: 3,
      gradedCount: 4,
      wrongIndices: [1],
    });
    await recordQuizAttempt('book_1_ch_0', {
      date: '2026-05-13T01:00:00Z',
      percent: 50,
      correctCount: 2,
      gradedCount: 4,
      wrongIndices: [0, 3],
    });
    await showQuiz(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const hub = pane.children[0]!;
    const stats = hub.querySelector('.quiz__stats');
    // "Best 75% · 2 attempts" (most recent attempt was 50% — best still 75)
    expect(stats?.textContent).toContain('75');
    expect(stats?.textContent).toContain('2 attempt');
  });

  it('shows "Retake wrong" only when last attempt has wrong items', async () => {
    const { pane, toastContainer } = makeContainer();
    await dbPut(STORE_CHAPTERS, chapter());
    // Last attempt has wrong items
    await recordQuizAttempt('book_1_ch_0', {
      date: '2026-05-13T00:00:00Z',
      percent: 75,
      correctCount: 3,
      gradedCount: 4,
      wrongIndices: [1, 2],
    });
    await showQuiz(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const retake = pane.children[0]!.querySelector('.quiz__btn[data-role="retake-wrong"]');
    expect(retake).not.toBeNull();
    expect(retake?.textContent).toContain('2'); // wrong count
  });

  it('shows Generate More + Regenerate when attempts exist', async () => {
    const { pane, toastContainer } = makeContainer();
    await dbPut(STORE_CHAPTERS, chapter());
    await recordQuizAttempt('book_1_ch_0', {
      date: '2026-05-13T00:00:00Z',
      percent: 100,
      correctCount: 4,
      gradedCount: 4,
      wrongIndices: [],
    });
    await showQuiz(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    expect(pane.children[0]!.querySelector('.quiz__btn[data-role="more"]')).not.toBeNull();
    expect(pane.children[0]!.querySelector('.quiz__btn[data-role="regenerate"]')).not.toBeNull();
    // No wrong items → no Retake wrong button.
    expect(pane.children[0]!.querySelector('.quiz__btn[data-role="retake-wrong"]')).toBeNull();
  });

  it('renders an error message with Retry when Start is clicked without an API key', async () => {
    const { pane, toastContainer } = makeContainer();
    await dbPut(STORE_CHAPTERS, chapter());
    await showQuiz(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const start = pane.children[0]!.querySelector('.quiz__btn[data-role="start"]');
    start!.dispatchEvent('click');
    // Wait for the async startQuiz to complete (microtask)
    await new Promise((r) => setTimeout(r, 0));
    const view = pane.children[0]!;
    expect(view.className).toContain('quiz--error');
    expect(view.querySelector('.quiz__btn[data-role="quiz-retry"]')).not.toBeNull();
  });

  it('shows an error toast on a 500 from Start, and Retry re-runs loadQuiz with the same cache key (TB.12 AC #1–4)', async () => {
    setSecret('aiApiKey', 'sk-ant-test-xyz');
    const { pane, toastContainer } = makeContainer();
    await dbPut(STORE_CHAPTERS, chapter());
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    // First call: 400 (non-retryable) so the test stays fast and the
    // retry path consumes the second mock. AC #3 specifies "a 500"; the
    // explicit 500 toast assertion lives in the Regenerate test below.
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'm',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                questions: [
                  {
                    type: 'multiple_choice',
                    prompt: 'Q1',
                    options: ['a', 'b', 'c', 'd'],
                    correctIndex: 0,
                    explanation: 'because',
                  },
                ],
              }),
            },
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await showQuiz(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    pane.children[0]!.querySelector('.quiz__btn[data-role="start"]')!.dispatchEvent('click');
    await vi.waitFor(() => {
      if (!pane.children[0]!.className.includes('quiz--error')) throw new Error('not yet error');
    });

    // Toast surfaced (AC #1, #3).
    const toast = toastContainer.children[0];
    expect(toast).toBeDefined();
    expect(toast!.className).toContain('toast--error');

    // Retry is present (AC #2).
    const retry = pane.children[0]!.querySelector('.quiz__btn[data-role="quiz-retry"]');
    expect(retry).not.toBeNull();

    // Click retry — re-runs the SAME loadQuiz call (AC #2, #4).
    retry!.dispatchEvent('click');
    await vi.waitFor(() => {
      if (!pane.children[0]!.className.includes('quiz--question')) {
        throw new Error('not yet at question');
      }
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const { getCachedGeneration } = await import('../lib/cache');
    const cached = await getCachedGeneration<{ questions: unknown[] }>('quiz', 'book_1_ch_0');
    expect(cached).toBeDefined();
  });

  it('shows an error toast and Retry on a Regenerate failure (TB.12 AC #1, #2, #3 — fake 500)', async () => {
    setSecret('aiApiKey', 'sk-ant-test-xyz');
    const { pane, toastContainer } = makeContainer();
    await dbPut(STORE_CHAPTERS, chapter());
    await recordQuizAttempt('book_1_ch_0', {
      date: '2026-05-13T00:00:00Z',
      percent: 100,
      correctCount: 1,
      gradedCount: 1,
      wrongIndices: [],
    });
    // SDK retries 5xx; mockResolvedValue makes every retry fail.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'boom' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await showQuiz(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    pane.children[0]!.querySelector('.quiz__btn[data-role="regenerate"]')!.dispatchEvent('click');
    await vi.waitFor(
      () => {
        if (!pane.children[0]!.className.includes('quiz--error')) throw new Error('not yet error');
      },
      { timeout: 8000 },
    );
    const toast = toastContainer.children[0];
    expect(toast).toBeDefined();
    expect(toast!.className).toContain('toast--error');
    expect(pane.children[0]!.querySelector('.quiz__btn[data-role="quiz-retry"]')).not.toBeNull();
  }, 10_000);

  it('uses the in-memory API key from secrets.ts when Start is clicked', async () => {
    setSecret('aiApiKey', 'sk-ant-test-xyz');
    const { pane, toastContainer } = makeContainer();
    await dbPut(STORE_CHAPTERS, chapter());
    // Mock fetch to resolve fast so the async chain finishes within a
    // bounded number of microtask ticks. The actual response shape is
    // irrelevant — we only assert fetch was called (meaning showQuiz
    // got past the API-key gate into loadQuiz).
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'm',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [{ type: 'text', text: JSON.stringify({ questions: [] }) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await showQuiz(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const start = pane.children[0]!.querySelector('.quiz__btn[data-role="start"]');
    start!.dispatchEvent('click');
    // Flush a handful of microtask ticks so the async chain reaches fetch.
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).toHaveBeenCalled();
  });
});
