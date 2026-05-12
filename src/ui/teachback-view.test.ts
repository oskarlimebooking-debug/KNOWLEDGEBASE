import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  renderTeachback,
  renderTeachbackError,
  renderTeachbackLoading,
  renderTeachbackResult,
  scoreTier,
  showTeachback,
} from './teachback-view';
import { clearAllSecrets, setSecret } from '../data/secrets';
import { closeDb, dbPut } from '../data/db';
import { STORE_GENERATED } from '../data/schema';
import { asHTMLElement, makeDoc } from '../test/dom-stub';
import type { Chapter } from '../lib/importers/types';
import type { GeneratedRow } from '../lib/cache';
import type { TeachbackAttempt, TeachbackResult } from '../ai/modes/teachback';

const SAMPLE_RESULT: TeachbackResult = {
  strengths: ['Correctly described light absorption', 'Mentioned chlorophyll'],
  gaps: ['Did not mention the Calvin cycle'],
  suggestions: ['Review the light-independent reactions'],
  score: 72,
};

function chapter(): Chapter {
  return {
    id: 'book_1_ch_0',
    bookId: 'book_1',
    index: 0,
    title: 'Photosynthesis',
    content: 'Some content.',
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

describe('scoreTier (AC #2 — color tiers)', () => {
  it('classifies 0..39 as "low" (red)', () => {
    expect(scoreTier(0)).toBe('low');
    expect(scoreTier(20)).toBe('low');
    expect(scoreTier(39)).toBe('low');
  });

  it('classifies 40..69 as "mid" (yellow)', () => {
    expect(scoreTier(40)).toBe('mid');
    expect(scoreTier(55)).toBe('mid');
    expect(scoreTier(69)).toBe('mid');
  });

  it('classifies 70..100 as "high" (green)', () => {
    expect(scoreTier(70)).toBe('high');
    expect(scoreTier(85)).toBe('high');
    expect(scoreTier(100)).toBe('high');
  });
});

describe('renderTeachback (form)', () => {
  it('renders the prompt label with the chapter title', () => {
    const json = JSON.stringify(renderTeachback(chapter(), ''));
    expect(json).toContain('Explain what you learned about');
    expect(json).toContain('Photosynthesis');
  });

  it('renders a textarea, Submit button, and inline error placeholder', () => {
    const json = JSON.stringify(renderTeachback(chapter(), ''));
    expect(json).toContain('"data-role":"teachback-textarea"');
    expect(json).toContain('"data-role":"teachback-submit"');
    expect(json).toContain('"data-role":"teachback-validation"');
  });

  it('seeds the textarea with the prior explanation when revisiting', () => {
    const json = JSON.stringify(renderTeachback(chapter(), 'I remember about light reactions.'));
    expect(json).toContain('I remember about light reactions.');
  });
});

describe('renderTeachbackLoading', () => {
  it('renders a spinner with aria-live polite', () => {
    const json = JSON.stringify(renderTeachbackLoading());
    expect(json).toContain('teachback--loading');
    expect(json).toContain('"aria-live":"polite"');
    expect(json).toContain('Evaluating');
  });
});

describe('renderTeachbackError', () => {
  it('renders the message + role=alert + Retry button', () => {
    const json = JSON.stringify(renderTeachbackError('boom'));
    expect(json).toContain('teachback--error');
    expect(json).toContain('boom');
    expect(json).toContain('"role":"alert"');
    expect(json).toContain('"data-role":"teachback-retry"');
  });
});

describe('renderTeachbackResult (AC #2 — score badge with tier)', () => {
  it('renders score badge with data-tier reflecting the color tier', () => {
    const high = JSON.stringify(renderTeachbackResult({ ...SAMPLE_RESULT, score: 85 }));
    expect(high).toContain('"data-tier":"high"');
    expect(high).toContain('85');
    const mid = JSON.stringify(renderTeachbackResult({ ...SAMPLE_RESULT, score: 50 }));
    expect(mid).toContain('"data-tier":"mid"');
    const low = JSON.stringify(renderTeachbackResult({ ...SAMPLE_RESULT, score: 10 }));
    expect(low).toContain('"data-tier":"low"');
  });

  it('renders sections for strengths, gaps, and suggestions', () => {
    const json = JSON.stringify(renderTeachbackResult(SAMPLE_RESULT));
    expect(json).toContain('Strengths');
    expect(json).toContain('Gaps');
    expect(json).toContain('Suggestions');
    expect(json).toContain('Correctly described light absorption');
    expect(json).toContain('Did not mention the Calvin cycle');
    expect(json).toContain('Review the light-independent reactions');
  });

  it('renders one list item per entry', () => {
    const json = JSON.stringify(renderTeachbackResult(SAMPLE_RESULT));
    const liCount = (json.match(/"tag":"li"/g) ?? []).length;
    // 2 strengths + 1 gap + 1 suggestion = 4
    expect(liCount).toBe(4);
  });
});

describe('showTeachback', () => {
  function makeContainer() {
    const doc = makeDoc();
    const pane = doc.createElement('div');
    const toastContainer = doc.createElement('div');
    return { doc, pane, toastContainer };
  }

  it('renders the error empty-state with Retry when no API key is set', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    await showTeachback(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const node = pane.children[0]!;
    expect(node.className).toContain('teachback--error');
    expect(node.querySelector('.teachback__retry')).not.toBeNull();
  });

  it('renders the form (with empty textarea) when no cached attempt exists', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    await showTeachback(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    expect(root.className).toContain('teachback');
    expect(root.querySelector('[data-role="teachback-textarea"]')).not.toBeNull();
    expect(root.querySelector('[data-role="teachback-submit"]')).not.toBeNull();
    // No result panel content yet.
    expect(root.querySelector('.teachback__result')).toBeNull();
  });

  it('seeds form + result from cache on revisit (AC #3)', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    const attempt: TeachbackAttempt = {
      explanation: 'My prior explanation about photosynthesis.',
      result: SAMPLE_RESULT,
    };
    const row: GeneratedRow<TeachbackAttempt> = {
      id: 'teachback_book_1_ch_0',
      chapterId: 'book_1_ch_0',
      type: 'teachback',
      content: attempt,
      createdAt: '2026-05-12T00:00:00.000Z',
    };
    await dbPut(STORE_GENERATED, row);

    await showTeachback(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const textarea = root.querySelector('[data-role="teachback-textarea"]')!;
    expect(textarea.textContent).toBe('My prior explanation about photosynthesis.');
    const resultPanel = root.querySelector('.teachback__result');
    expect(resultPanel).not.toBeNull();
    expect(resultPanel?.querySelector('.teachback__score')?.textContent).toContain('72');
  });

  it('shows inline validation on empty submit and does NOT call the API (AC #4)', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await showTeachback(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const submit = root.querySelector('[data-role="teachback-submit"]')!;
    submit.dispatchEvent('click');

    const validation = root.querySelector('[data-role="teachback-validation"]')!;
    expect(validation.textContent?.length ?? 0).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('also rejects whitespace-only submissions inline (AC #4)', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await showTeachback(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const textarea = root.querySelector('[data-role="teachback-textarea"]')!;
    textarea.textContent = '   \n  ';
    const submit = root.querySelector('[data-role="teachback-submit"]')!;
    submit.dispatchEvent('click');

    const validation = root.querySelector('[data-role="teachback-validation"]')!;
    expect(validation.textContent?.length ?? 0).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('clears the inline validation after a successful submit', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(SAMPLE_RESULT));

    await showTeachback(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const textarea = root.querySelector('[data-role="teachback-textarea"]')!;
    // First, an empty submit to seed the validation message.
    root.querySelector('[data-role="teachback-submit"]')!.dispatchEvent('click');
    expect(
      (root.querySelector('[data-role="teachback-validation"]')!.textContent?.length ?? 0) > 0,
    ).toBe(true);
    // Then a real submission.
    textarea.textContent = 'I learned a lot.';
    root.querySelector('[data-role="teachback-submit"]')!.dispatchEvent('click');
    await vi.waitFor(() => {
      const result = pane.children[0]!.querySelector('.teachback__result');
      if (result === null) throw new Error('result not yet rendered');
    });
    const validation = pane.children[0]!.querySelector('[data-role="teachback-validation"]')!;
    expect(validation.textContent ?? '').toBe('');
  });

  it('submits the explanation and renders the result on success (AC #1)', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(SAMPLE_RESULT));

    await showTeachback(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const textarea = root.querySelector('[data-role="teachback-textarea"]')!;
    textarea.textContent = 'I learned that plants convert light.';
    root.querySelector('[data-role="teachback-submit"]')!.dispatchEvent('click');

    await vi.waitFor(() => {
      const result = pane.children[0]!.querySelector('.teachback__result');
      if (result === null) throw new Error('result not yet rendered');
    });
    const result = pane.children[0]!.querySelector('.teachback__result')!;
    expect(result.querySelector('.teachback__score')?.textContent).toContain('72');
    expect(result.querySelector('[data-tier="high"]')).not.toBeNull();
  });

  it('renders error state on API failure', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'down' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await showTeachback(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const root = pane.children[0]!;
    const textarea = root.querySelector('[data-role="teachback-textarea"]')!;
    textarea.textContent = 'I learned something.';
    root.querySelector('[data-role="teachback-submit"]')!.dispatchEvent('click');

    await vi.waitFor(() => {
      const errEl = pane.children[0]!.querySelector('.teachback__result-error');
      if (errEl === null) throw new Error('error not yet rendered');
    });
    expect(pane.children[0]!.querySelector('.teachback__result-error')).not.toBeNull();
  });
});
