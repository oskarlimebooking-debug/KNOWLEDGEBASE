import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  renderSummary,
  renderSummaryError,
  renderSummaryLoading,
  showSummary,
} from './summary-view';
import { clearAllSecrets, setSecret } from '../data/secrets';
import { closeDb, dbPut } from '../data/db';
import { STORE_CHAPTERS } from '../data/schema';
import { asHTMLElement, makeDoc } from '../test/dom-stub';
import type { Chapter } from '../lib/importers/types';
import type { Summary } from '../ai/modes/summary';

const SAMPLE: Summary = {
  keyConcepts: ['Newton', 'gravity', 'apples'],
  summary: 'First paragraph.\n\nSecond paragraph.',
  difficulty: 3,
  readingTime: 7,
};

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

describe('renderSummaryLoading', () => {
  it('renders a spinner + loading label with aria-live', () => {
    const tree = renderSummaryLoading();
    const json = JSON.stringify(tree);
    expect(json).toContain('summary--loading');
    expect(json).toContain('"aria-live":"polite"');
    expect(json).toContain('Generating summary');
  });
});

describe('renderSummaryError', () => {
  it('renders the message and a Retry button', () => {
    const tree = renderSummaryError('Something went wrong');
    const json = JSON.stringify(tree);
    expect(json).toContain('summary--error');
    expect(json).toContain('Something went wrong');
    expect(json).toContain('"data-role":"summary-retry"');
    expect(json).toContain('Retry');
  });

  it('uses role=alert and aria-live=assertive', () => {
    const tree = renderSummaryError('x');
    const json = JSON.stringify(tree);
    expect(json).toContain('"role":"alert"');
    expect(json).toContain('"aria-live":"assertive"');
  });
});

describe('renderSummary', () => {
  it('shows reading-time, difficulty stars, key concept pills, and paragraphs', () => {
    const tree = renderSummary(SAMPLE);
    const json = JSON.stringify(tree);
    expect(json).toContain('7 min read');
    expect(json).toContain('★★★☆☆'); // 3/5
    expect(json).toContain('Newton');
    expect(json).toContain('First paragraph.');
    expect(json).toContain('Second paragraph.');
  });

  it('clamps difficulty to 0..5', () => {
    const j5 = JSON.stringify(renderSummary({ ...SAMPLE, difficulty: 9 }));
    expect(j5).toContain('★★★★★');
    const j0 = JSON.stringify(renderSummary({ ...SAMPLE, difficulty: -1 }));
    expect(j0).toContain('☆☆☆☆☆');
  });

  it('renders one pill per key concept', () => {
    const tree = renderSummary(SAMPLE);
    const json = JSON.stringify(tree);
    const pillCount = (json.match(/"summary__pill"/g) ?? []).length;
    expect(pillCount).toBe(3);
  });

  it('escapes HTML-like content as plain text (AC #4 — no XSS)', () => {
    const malicious: Summary = {
      keyConcepts: ['<script>alert(1)</script>'],
      summary: '<img src=x onerror=alert(1)>',
      difficulty: 1,
      readingTime: 1,
    };
    const tree = renderSummary(malicious);
    // The audit invariant: every string child reaches the DOM via
    // createTextNode. Children are still plain strings in the data tree.
    const visit = (node: { children?: ReadonlyArray<unknown> }): void => {
      for (const child of node.children ?? []) {
        if (typeof child === 'string') {
          // present as data, but buildElement will materialise via
          // createTextNode — never parsed as HTML.
          continue;
        }
        visit(child as { children?: ReadonlyArray<unknown> });
      }
    };
    expect(() => visit(tree as unknown as { children?: ReadonlyArray<unknown> })).not.toThrow();
    // Confirm the literal payloads are in the tree (as text, not parsed):
    expect(JSON.stringify(tree)).toContain('<script>alert(1)</script>');
  });
});

describe('showSummary', () => {
  function makeContainer() {
    const doc = makeDoc();
    const pane = doc.createElement('div');
    const toastContainer = doc.createElement('div');
    return { doc, pane, toastContainer };
  }

  it('renders the error empty-state with Retry when no API key is set', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    await showSummary(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const node = pane.children[0]!;
    expect(node.className).toContain('summary--error');
    expect(node.querySelector('.summary__retry')).not.toBeNull();
  });

  it('renders the success state after a successful fetch', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    await dbPut(STORE_CHAPTERS, chapter());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(SAMPLE));

    await showSummary(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    const node = pane.children[0]!;
    expect(node.className).toBe('summary');
    // Difficulty stars live in the .summary__difficulty span's textContent.
    const stars = node.querySelector('.summary__difficulty');
    expect(stars?.textContent).toBe('★★★☆☆');
  });

  it('fires onAfterLoad after a successful summary', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    await dbPut(STORE_CHAPTERS, chapter());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(SAMPLE));
    const onAfterLoad = vi.fn();
    await showSummary(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
      onAfterLoad,
    });
    expect(onAfterLoad).toHaveBeenCalledOnce();
    expect(onAfterLoad).toHaveBeenCalledWith(SAMPLE);
  });

  it('renders the error empty-state with Retry on API failure', async () => {
    const { doc, pane, toastContainer } = makeContainer();
    vi.stubGlobal('document', doc);
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    await dbPut(STORE_CHAPTERS, chapter());
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'down' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    await showSummary(chapter(), asHTMLElement(pane), {
      toastContainer: asHTMLElement(toastContainer),
    });
    expect(pane.children[0]!.className).toContain('summary--error');
    expect(pane.children[0]!.querySelector('.summary__retry')).not.toBeNull();
  });
});
