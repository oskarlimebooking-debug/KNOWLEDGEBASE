import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { formatAllChapters, formatChapter } from './format-text';
import { closeDb, dbGet, dbPut } from '../../data/db';
import { STORE_CHAPTERS } from '../../data/schema';
import type { Chapter } from '../../lib/importers/types';

const API_KEY = 'sk-ant-test-abc123';

function chapter(id = 'book_1_ch_0'): Chapter {
  return {
    id,
    bookId: 'book_1',
    index: 0,
    title: 'Forces of Nature',
    content: 'Some body text.',
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

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});

describe('formatChapter', () => {
  it('throws when no API key', async () => {
    await expect(formatChapter(chapter(), '')).rejects.toThrow(/API key/i);
  });

  it('persists sanitised HTML to chapter.formattedHtml', async () => {
    await dbPut(STORE_CHAPTERS, chapter());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse('<h2>Title</h2><p>Body <strong>bold</strong>.</p>'),
    );
    const result = await formatChapter(chapter(), API_KEY);
    expect(result).toContain('<h2>');
    expect(result).toContain('<p>');
    const stored = await dbGet<Chapter>(STORE_CHAPTERS, 'book_1_ch_0');
    expect(stored?.formattedHtml).toBe(result);
  });

  it('strips disallowed tags via TB.9 sanitizeHtml (AC #3)', async () => {
    await dbPut(STORE_CHAPTERS, chapter());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse(
        '<p>Safe.</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
      ),
    );
    const result = await formatChapter(chapter(), API_KEY);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('onerror');
    expect(result).toContain('<p>Safe.</p>');
  });

  it('preserves other chapter fields (e.g. difficulty)', async () => {
    await dbPut(STORE_CHAPTERS, { ...chapter(), difficulty: 4 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse('<p>x</p>'));
    await formatChapter({ ...chapter(), difficulty: 4 }, API_KEY);
    const stored = await dbGet<Chapter>(STORE_CHAPTERS, 'book_1_ch_0');
    expect(stored?.difficulty).toBe(4);
    expect(stored?.formattedHtml).toContain('<p>');
  });

  it('substitutes {title}/{content} into the prompt', async () => {
    await dbPut(STORE_CHAPTERS, chapter());
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse('<p>ok</p>'));
    await formatChapter(chapter(), API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0]!.content).toContain('Forces of Nature');
    expect(body.messages[0]!.content).toContain('Some body text.');
  });
});

describe('formatAllChapters', () => {
  it('invokes onProgress per chapter and writes formattedHtml on each', async () => {
    const chapters = [chapter('a'), chapter('b'), chapter('c')];
    for (const c of chapters) await dbPut(STORE_CHAPTERS, c);
    // mockImplementation returns a fresh Response per call (Response bodies
    // are one-shot — mockResolvedValue would fail on the second chapter).
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(anthropicResponse('<p>ok</p>')),
    );
    const progress: number[] = [];
    const result = await formatAllChapters(chapters, API_KEY, (p) => {
      progress.push(p.currentIndex);
    });
    expect(result.errored).toEqual([]);
    expect(progress).toEqual([0, 1, 2]);
    for (const c of chapters) {
      const stored = await dbGet<Chapter>(STORE_CHAPTERS, c.id);
      expect(stored?.formattedHtml).toContain('<p>');
    }
  });

  it('continues past a failing chapter and records the error', async () => {
    const chapters = [chapter('a'), chapter('b'), chapter('c')];
    for (const c of chapters) await dbPut(STORE_CHAPTERS, c);
    let call = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      call++;
      if (call === 2) {
        // Fail the second chapter (400 isn't retried by the SDK).
        return Promise.resolve(
          new Response(
            JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(anthropicResponse('<p>ok</p>'));
    });
    const events: Array<{ idx: number; err: boolean }> = [];
    const result = await formatAllChapters(chapters, API_KEY, (p) => {
      events.push({ idx: p.currentIndex, err: p.error !== null });
    });
    expect(result.errored).toEqual(['b']);
    expect(events).toEqual([
      { idx: 0, err: false },
      { idx: 1, err: true },
      { idx: 2, err: false },
    ]);
  });
});
