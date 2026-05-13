import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { openFormatTextDialog } from './format-text-dialog';
import { closeDb, dbPut } from '../data/db';
import { STORE_CHAPTERS } from '../data/schema';
import { clearAllSecrets, setSecret } from '../data/secrets';
import { asDocument, asHTMLElement, makeDoc } from '../test/dom-stub';
import type { Chapter } from '../lib/importers/types';

function chapter(id = 'book_1_ch_0', index = 0): Chapter {
  return {
    id,
    bookId: 'book_1',
    index,
    title: 'Forces of Nature',
    content: 'Body text.',
  };
}

function anthropicResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_x',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function setup() {
  const doc = makeDoc();
  const stack = doc.createElement('div');
  const toastContainer = doc.createElement('div');
  vi.stubGlobal('document', doc);
  return { doc, stack, toastContainer };
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

describe('openFormatTextDialog', () => {
  it('mounts a dialog with Format current + Format all choices', () => {
    const { doc, stack, toastContainer } = setup();
    openFormatTextDialog(
      asHTMLElement(stack),
      { currentChapter: chapter(), toastContainer: asHTMLElement(toastContainer) },
      asDocument(doc),
    );
    const modal = stack.children[0]!.children[0]!;
    expect(modal.className).toBe('modal');
    expect(modal.querySelector('[data-role="format-current"]')).not.toBeNull();
    expect(modal.querySelector('[data-role="format-all"]')).not.toBeNull();
  });

  it('shows an error toast when no API key is set and a format action is clicked', async () => {
    const { doc, stack, toastContainer } = setup();
    openFormatTextDialog(
      asHTMLElement(stack),
      { currentChapter: chapter(), toastContainer: asHTMLElement(toastContainer) },
      asDocument(doc),
    );
    const fmt = stack.children[0]!.children[0]!.querySelector('[data-role="format-current"]');
    fmt!.dispatchEvent('click');
    // toast appended to toastContainer
    expect(toastContainer.children.length).toBeGreaterThan(0);
    const toast = toastContainer.children[0]!;
    expect(toast.className).toContain('toast--error');
  });

  it('formats the current chapter when API key is set (AC #1)', async () => {
    const { doc, stack, toastContainer } = setup();
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    await dbPut(STORE_CHAPTERS, chapter());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse('<h2>T</h2><p>Body.</p>'),
    );
    const onAfterFormat = vi.fn();
    openFormatTextDialog(
      asHTMLElement(stack),
      {
        currentChapter: chapter(),
        toastContainer: asHTMLElement(toastContainer),
        onAfterFormat,
      },
      asDocument(doc),
    );
    const fmt = stack.children[0]!.children[0]!.querySelector('[data-role="format-current"]');
    fmt!.dispatchEvent('click');
    // Flush async chain
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    expect(onAfterFormat).toHaveBeenCalled();
  });

  it('renders a progress bar during Format all (AC #2)', async () => {
    const { doc, stack, toastContainer } = setup();
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    await dbPut(STORE_CHAPTERS, chapter('a', 0));
    await dbPut(STORE_CHAPTERS, chapter('b', 1));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(anthropicResponse('<p>x</p>')),
    );
    openFormatTextDialog(
      asHTMLElement(stack),
      { currentChapter: chapter('a', 0), toastContainer: asHTMLElement(toastContainer) },
      asDocument(doc),
    );
    const all = stack.children[0]!.children[0]!.querySelector('[data-role="format-all"]');
    all!.dispatchEvent('click');
    // Briefly: a progress bar appears in the status area mid-run
    await new Promise((r) => setTimeout(r, 0));
    const statusEl = stack.children[0]!.children[0]!.querySelector('[data-role="status"]');
    // The status container will contain either the progress tree or
    // an inline-loading node; both are evidence the run started.
    expect(statusEl?.children.length ?? 0).toBeGreaterThan(0);
    // Flush to completion
    for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
  });

  it('does not close on Escape while a run is in progress', async () => {
    const { doc, stack, toastContainer } = setup();
    setSecret('aiApiKey', 'sk-ant-test-abc123');
    await dbPut(STORE_CHAPTERS, chapter());
    // Hold the fetch open so the run stays in progress.
    type ResolveFetch = (r: Response) => void;
    const resolveFetchHolder: { fn: ResolveFetch | null } = { fn: null };
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetchHolder.fn = resolve;
        }),
    );
    openFormatTextDialog(
      asHTMLElement(stack),
      { currentChapter: chapter(), toastContainer: asHTMLElement(toastContainer) },
      asDocument(doc),
    );
    const fmt = stack.children[0]!.children[0]!.querySelector('[data-role="format-current"]');
    fmt!.dispatchEvent('click');
    await new Promise((r) => setTimeout(r, 0));
    // Try Escape — should be ignored while running
    (asDocument(doc) as unknown as { dispatchEvent(e: string, p: unknown): void }).dispatchEvent(
      'keydown',
      { key: 'Escape' },
    );
    expect(stack.children.length).toBe(1); // still open
    // Unblock fetch so we don't leave the promise dangling
    resolveFetchHolder.fn?.(anthropicResponse('<p>ok</p>'));
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  });
});
