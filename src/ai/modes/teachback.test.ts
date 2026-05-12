import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  evaluateTeachback,
  loadCachedTeachback,
  type TeachbackAttempt,
  type TeachbackResult,
} from './teachback';
import { closeDb, dbGet, dbPut, setSetting } from '../../data/db';
import { STORE_GENERATED } from '../../data/schema';
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
    title: 'Photosynthesis',
    content: 'Plants convert light into energy.',
  };
}

const validResult: TeachbackResult = {
  strengths: ['Correctly described light absorption', 'Mentioned chlorophyll'],
  gaps: ['Did not mention the Calvin cycle'],
  suggestions: ['Review the light-independent reactions'],
  score: 72,
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});

describe('evaluateTeachback', () => {
  it('throws when the API key is empty', async () => {
    await expect(evaluateTeachback(chapter(), 'explanation text', '')).rejects.toThrow(
      /API key/i,
    );
  });

  it('throws when the explanation is empty (AC #4 — guard server-side)', async () => {
    await expect(evaluateTeachback(chapter(), '', API_KEY)).rejects.toThrow(/explanation/i);
  });

  it('throws when the explanation is only whitespace', async () => {
    await expect(evaluateTeachback(chapter(), '   \n   ', API_KEY)).rejects.toThrow(
      /explanation/i,
    );
  });

  it('returns the parsed result from a valid API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(validResult));
    const out = await evaluateTeachback(chapter(), 'I understood photosynthesis.', API_KEY);
    expect(out).toEqual(validResult);
  });

  it('substitutes {title}/{content}/{explanation} into the prompt', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse(validResult));
    await setSetting('prompt_teachback', 'T={title} C={content} E={explanation}');
    await evaluateTeachback(chapter(), 'My explanation.', API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0]!.content).toContain('T=Photosynthesis');
    expect(body.messages[0]!.content).toContain('C=Plants convert light into energy.');
    expect(body.messages[0]!.content).toContain('E=My explanation.');
  });

  it('requests strict json_schema enforcement', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(anthropicResponse(validResult));
    await evaluateTeachback(chapter(), 'explanation.', API_KEY);
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
    await expect(evaluateTeachback(chapter(), 'explanation.', API_KEY)).rejects.toThrow(
      /JSON/i,
    );
  });

  it('rejects when the shape is wrong (missing score)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({
        strengths: ['a'],
        gaps: ['b'],
        suggestions: ['c'],
      }),
    );
    await expect(evaluateTeachback(chapter(), 'explanation.', API_KEY)).rejects.toThrow(
      /shape/i,
    );
  });

  it('rejects when the score is out of range', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ ...validResult, score: 150 }),
    );
    await expect(evaluateTeachback(chapter(), 'explanation.', API_KEY)).rejects.toThrow(
      /shape/i,
    );
  });

  it('caches the attempt under the locked `teachback_<chapterId>` key (AC #3)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse(validResult));
    await evaluateTeachback(chapter(), 'My explanation.', API_KEY);
    const row = await dbGet<GeneratedRow<TeachbackAttempt>>(
      STORE_GENERATED,
      'teachback_book_1_ch_0',
    );
    expect(row?.id).toBe('teachback_book_1_ch_0');
    expect(row?.type).toBe('teachback');
    expect(row?.content.explanation).toBe('My explanation.');
    expect(row?.content.result).toEqual(validResult);
  });

  it('overwrites the cached attempt on resubmit', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(anthropicResponse(validResult));
    fetchSpy.mockResolvedValueOnce(
      anthropicResponse({ ...validResult, score: 95 }),
    );
    await evaluateTeachback(chapter(), 'First attempt.', API_KEY);
    await evaluateTeachback(chapter(), 'Second attempt.', API_KEY);
    const row = await dbGet<GeneratedRow<TeachbackAttempt>>(
      STORE_GENERATED,
      'teachback_book_1_ch_0',
    );
    expect(row?.content.explanation).toBe('Second attempt.');
    expect(row?.content.result.score).toBe(95);
  });

  it('does not cache when the API call errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'down' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    await expect(evaluateTeachback(chapter(), 'explanation.', API_KEY)).rejects.toBeTruthy();
    const row = await dbGet(STORE_GENERATED, 'teachback_book_1_ch_0');
    expect(row).toBeUndefined();
  });
});

describe('loadCachedTeachback (AC #3 — cache lets user revisit last attempt)', () => {
  it('returns undefined when no attempt has been cached yet', async () => {
    const out = await loadCachedTeachback('book_1_ch_0');
    expect(out).toBeUndefined();
  });

  it('returns the stored attempt without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const attempt: TeachbackAttempt = {
      explanation: 'Previously stored explanation.',
      result: validResult,
    };
    const row: GeneratedRow<TeachbackAttempt> = {
      id: 'teachback_book_1_ch_0',
      chapterId: 'book_1_ch_0',
      type: 'teachback',
      content: attempt,
      createdAt: '2026-05-12T00:00:00.000Z',
    };
    await dbPut(STORE_GENERATED, row);
    const out = await loadCachedTeachback('book_1_ch_0');
    expect(out).toEqual(attempt);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
