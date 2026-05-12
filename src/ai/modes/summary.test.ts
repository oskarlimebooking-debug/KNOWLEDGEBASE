import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { generateSummaryRaw, loadSummary, type Summary } from './summary';
import {
  closeDb,
  dbGet,
  dbPut,
  setSetting,
} from '../../data/db';
import {
  STORE_CHAPTERS,
  STORE_GENERATED,
} from '../../data/schema';
import type { Chapter } from '../../lib/importers/types';
import type { GeneratedRow } from '../../lib/cache';

const API_KEY = 'sk-ant-test-abc123';

function anthropicResponse(payload: unknown, status = 200): Response {
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
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

function chapter(): Chapter {
  return {
    id: 'book_1_ch_0',
    bookId: 'book_1',
    index: 0,
    title: 'The Beginning',
    content: 'Once upon a time...',
  };
}

const validSummary: Summary = {
  keyConcepts: ['intro', 'world', 'protagonist'],
  summary: 'A story begins.',
  difficulty: 3,
  readingTime: 5,
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});

describe('generateSummaryRaw', () => {
  it('throws when no API key is set', async () => {
    await expect(generateSummaryRaw(chapter(), '')).rejects.toThrow(/API key/i);
  });

  it('returns the parsed summary from the API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(validSummary));
    expect(await generateSummaryRaw(chapter(), API_KEY)).toEqual(validSummary);
  });

  it('writes back chapter.difficulty to the chapter row', async () => {
    await dbPut(STORE_CHAPTERS, chapter());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(validSummary));
    await generateSummaryRaw(chapter(), API_KEY);
    const row = await dbGet<Chapter>(STORE_CHAPTERS, 'book_1_ch_0');
    expect(row?.difficulty).toBe(3);
  });

  it('sends the prompt with {title}/{content} substituted', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(validSummary));
    await setSetting('prompt_summary', 'TITLE={title} CONTENT={content}');
    await generateSummaryRaw(chapter(), API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0]!.content).toContain('TITLE=The Beginning');
    expect(body.messages[0]!.content).toContain('CONTENT=Once upon a time...');
  });

  it('requests strict json_schema enforcement', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(validSummary));
    await generateSummaryRaw(chapter(), API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      output_config?: { format?: { type?: string } };
    };
    expect(body.output_config?.format?.type).toBe('json_schema');
  });

  it('rejects malformed JSON in the API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'msg_x',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [{ type: 'text', text: 'not json' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await expect(generateSummaryRaw(chapter(), API_KEY)).rejects.toThrow(/JSON/i);
  });

  it('rejects when the shape is missing required fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ keyConcepts: ['a', 'b', 'c'], summary: 'x' }),
    );
    await expect(generateSummaryRaw(chapter(), API_KEY)).rejects.toThrow(/shape/i);
  });
});

describe('loadSummary — cache integration (TB.4 pattern)', () => {
  it('caches first call and short-circuits on second call (instant)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(validSummary));
    await dbPut(STORE_CHAPTERS, chapter());

    const first = await loadSummary(chapter(), API_KEY);
    const second = await loadSummary(chapter(), API_KEY);

    expect(first).toEqual(validSummary);
    expect(second).toEqual(validSummary);
    expect(fetchSpy).toHaveBeenCalledOnce(); // second open is from cache
  });

  it('stores the row under the locked `summary_<chapterId>` key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(validSummary));
    await dbPut(STORE_CHAPTERS, chapter());
    await loadSummary(chapter(), API_KEY);
    const row = await dbGet<GeneratedRow<Summary>>(STORE_GENERATED, 'summary_book_1_ch_0');
    expect(row?.id).toBe('summary_book_1_ch_0');
    expect(row?.type).toBe('summary');
    expect(row?.content).toEqual(validSummary);
  });

  it('does not cache when the API call errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'down' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    await dbPut(STORE_CHAPTERS, chapter());
    await expect(loadSummary(chapter(), API_KEY)).rejects.toBeTruthy();
    const row = await dbGet(STORE_GENERATED, 'summary_book_1_ch_0');
    expect(row).toBeUndefined();
  });
});
