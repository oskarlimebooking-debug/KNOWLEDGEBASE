import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  GENERATION_TYPES,
  type GeneratedRow,
  generationKey,
  getCachedGeneration,
  invalidateGeneration,
  withGenerationCache,
} from './cache';
import { closeDb, dbGet, dbGetByIndex, dbPut } from '../data/db';
import { STORE_GENERATED } from '../data/schema';
import type { Chapter } from './importers/types';

function makeChapter(id = 'book_1_ch_0'): Chapter {
  return { id, bookId: 'book_1', index: 0, title: 'Test', content: 'body' };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});

describe('generationKey + GENERATION_TYPES', () => {
  it('locks the documented `<type>_<chapterId>` shape', () => {
    // The G-Manual sprint gate: do not change without coordinating with
    // Drive sync (Phase F).
    expect(generationKey('summary', 'book_1_ch_0')).toBe('summary_book_1_ch_0');
    expect(generationKey('quiz', 'b2_ch_5')).toBe('quiz_b2_ch_5');
  });

  it('exposes the six canonical generation types frozen', () => {
    expect(GENERATION_TYPES).toEqual([
      'summary',
      'quiz',
      'flashcards',
      'teachback',
      'formatText',
      'chapterSplit',
    ]);
    expect(Object.isFrozen(GENERATION_TYPES)).toBe(true);
  });
});

describe('withGenerationCache — miss path', () => {
  it('calls the generator on miss and caches the result', async () => {
    const generator = vi.fn().mockResolvedValue({ keyConcepts: ['x'] });
    const loadSummary = withGenerationCache('summary', generator);

    const result = await loadSummary(makeChapter());
    expect(result).toEqual({ keyConcepts: ['x'] });
    expect(generator).toHaveBeenCalledOnce();

    // Row persisted with the canonical shape
    const row = await dbGet<GeneratedRow<{ keyConcepts: string[] }>>(
      STORE_GENERATED,
      'summary_book_1_ch_0',
    );
    expect(row?.id).toBe('summary_book_1_ch_0');
    expect(row?.type).toBe('summary');
    expect(row?.chapterId).toBe('book_1_ch_0');
    expect(row?.content).toEqual({ keyConcepts: ['x'] });
    expect(row?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('stores rows indexable by chapterId (matches schema index)', async () => {
    const loader = withGenerationCache('summary', vi.fn().mockResolvedValue('s'));
    await loader(makeChapter('book_1_ch_3'));
    const byChapter = await dbGetByIndex<GeneratedRow>(
      STORE_GENERATED,
      'chapterId',
      'book_1_ch_3',
    );
    expect(byChapter).toHaveLength(1);
    expect(byChapter[0]!.type).toBe('summary');
  });
});

describe('withGenerationCache — hit path', () => {
  it('skips the generator and returns the cached content on hit', async () => {
    const generator = vi.fn().mockResolvedValue('first');
    const loader = withGenerationCache('summary', generator);

    const first = await loader(makeChapter());
    const second = await loader(makeChapter());

    expect(first).toBe('first');
    expect(second).toBe('first');
    expect(generator).toHaveBeenCalledOnce();
  });

  it('returns the cached content if a row was seeded by another writer', async () => {
    // Simulate a row from Drive sync (Phase F): pre-existing cache entry.
    await dbPut(STORE_GENERATED, {
      id: 'quiz_book_1_ch_0',
      chapterId: 'book_1_ch_0',
      type: 'quiz',
      content: [{ q: 'pre-seeded' }],
      createdAt: '2025-01-01T00:00:00Z',
    });
    const generator = vi.fn();
    const loader = withGenerationCache('quiz', generator);
    const result = await loader(makeChapter());
    expect(result).toEqual([{ q: 'pre-seeded' }]);
    expect(generator).not.toHaveBeenCalled();
  });
});

describe('withGenerationCache — keying isolation', () => {
  it('keeps different types for the same chapter in separate rows', async () => {
    const summaryGen = vi.fn().mockResolvedValue('S');
    const quizGen = vi.fn().mockResolvedValue('Q');
    const loadSummary = withGenerationCache('summary', summaryGen);
    const loadQuiz = withGenerationCache('quiz', quizGen);
    const ch = makeChapter();
    expect(await loadSummary(ch)).toBe('S');
    expect(await loadQuiz(ch)).toBe('Q');
    expect(summaryGen).toHaveBeenCalledOnce();
    expect(quizGen).toHaveBeenCalledOnce();
  });

  it('keeps different chapters for the same type in separate rows', async () => {
    const generator = vi.fn().mockImplementation(async (c: Chapter) => `for-${c.id}`);
    const loader = withGenerationCache('summary', generator);
    expect(await loader(makeChapter('a'))).toBe('for-a');
    expect(await loader(makeChapter('b'))).toBe('for-b');
    expect(generator).toHaveBeenCalledTimes(2);
  });
});

describe('withGenerationCache — error path', () => {
  it('propagates generator errors and does not cache', async () => {
    const generator = vi.fn().mockRejectedValue(new Error('upstream down'));
    const loader = withGenerationCache('summary', generator);
    await expect(loader(makeChapter())).rejects.toThrow(/upstream down/);

    // No row written
    const row = await dbGet(STORE_GENERATED, 'summary_book_1_ch_0');
    expect(row).toBeUndefined();
  });

  it('next call after error retries the generator (no cached failure)', async () => {
    const generator = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok');
    const loader = withGenerationCache('summary', generator);
    await expect(loader(makeChapter())).rejects.toThrow(/transient/);
    expect(await loader(makeChapter())).toBe('ok');
    expect(generator).toHaveBeenCalledTimes(2);
  });
});

describe('invalidateGeneration', () => {
  it('removes the row so the next load re-runs the generator', async () => {
    const generator = vi
      .fn()
      .mockResolvedValueOnce('v1')
      .mockResolvedValueOnce('v2');
    const loader = withGenerationCache('summary', generator);
    expect(await loader(makeChapter())).toBe('v1');
    await invalidateGeneration('summary', 'book_1_ch_0');
    expect(await loader(makeChapter())).toBe('v2');
    expect(generator).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for a missing key', async () => {
    await expect(invalidateGeneration('summary', 'never_cached')).resolves.toBeUndefined();
  });
});

describe('getCachedGeneration', () => {
  it('returns undefined for a missing cache entry', async () => {
    expect(await getCachedGeneration('summary', 'ghost')).toBeUndefined();
  });

  it('returns the typed content for a present entry', async () => {
    await dbPut(STORE_GENERATED, {
      id: 'summary_book_1_ch_0',
      chapterId: 'book_1_ch_0',
      type: 'summary',
      content: { keyConcepts: ['a', 'b'] },
      createdAt: '2026-05-12T00:00:00Z',
    });
    const got = await getCachedGeneration<{ keyConcepts: string[] }>(
      'summary',
      'book_1_ch_0',
    );
    expect(got).toEqual({ keyConcepts: ['a', 'b'] });
  });
});
