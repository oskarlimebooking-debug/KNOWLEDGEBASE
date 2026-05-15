import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import {
  appendFlashcards,
  generateFlashcardsRaw,
  loadFlashcards,
  type Flashcard,
} from './flashcards';
import {
  closeDb,
  dbGet,
  dbPut,
  setSetting,
} from '../../data/db';
import {
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
    title: 'Photosynthesis',
    content: 'Plants convert light into energy.',
  };
}

function makeCards(n: number, prefix = 'Q'): Flashcard[] {
  return Array.from({ length: n }, (_, i) => ({
    front: `${prefix}${i + 1}`,
    back: `Answer ${i + 1}`,
  }));
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.restoreAllMocks();
});

afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});

describe('generateFlashcardsRaw', () => {
  it('throws when the API key is empty', async () => {
    await expect(generateFlashcardsRaw(chapter(), '')).rejects.toThrow(/API key/i);
  });

  it('returns the parsed cards from a valid API response', async () => {
    const cards = makeCards(6);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse({ cards }));
    const out = await generateFlashcardsRaw(chapter(), API_KEY);
    expect(out).toEqual(cards);
  });

  it('requires at least 5 cards (AC #1)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards: makeCards(3) }),
    );
    await expect(generateFlashcardsRaw(chapter(), API_KEY)).rejects.toThrow(/5/);
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
    await expect(generateFlashcardsRaw(chapter(), API_KEY)).rejects.toThrow(/JSON/i);
  });

  it('rejects when the shape is wrong (missing cards array)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ wrong: 'shape' }),
    );
    await expect(generateFlashcardsRaw(chapter(), API_KEY)).rejects.toThrow(/shape/i);
  });

  it('rejects when an item is missing front or back', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({
        cards: [
          { front: 'a', back: 'b' },
          { front: 'a' },
          { front: 'a', back: 'b' },
          { front: 'a', back: 'b' },
          { front: 'a', back: 'b' },
        ],
      }),
    );
    await expect(generateFlashcardsRaw(chapter(), API_KEY)).rejects.toThrow(/shape/i);
  });

  it('sends the substituted prompt template ({title}/{content})', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards: makeCards(5) }),
    );
    await setSetting('prompt_flashcards', 'T={title} C={content}');
    await generateFlashcardsRaw(chapter(), API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    expect(body.messages[0]!.content).toContain('T=Photosynthesis');
    expect(body.messages[0]!.content).toContain('C=Plants convert light into energy.');
  });

  it('requests strict json_schema enforcement', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards: makeCards(5) }),
    );
    await generateFlashcardsRaw(chapter(), API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      output_config?: { format?: { type?: string } };
    };
    expect(body.output_config?.format?.type).toBe('json_schema');
  });
});

describe('loadFlashcards — cache integration (TB.4 pattern)', () => {
  it('caches first call and short-circuits on second call', async () => {
    const cards = makeCards(6);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards }),
    );
    const first = await loadFlashcards(chapter(), API_KEY);
    const second = await loadFlashcards(chapter(), API_KEY);
    expect(first).toEqual(cards);
    expect(second).toEqual(cards);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('stores the row under the locked `flashcards_<chapterId>` key (AC #4)', async () => {
    const cards = makeCards(5);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse({ cards }));
    await loadFlashcards(chapter(), API_KEY);
    const row = await dbGet<GeneratedRow<Flashcard[]>>(
      STORE_GENERATED,
      'flashcards_book_1_ch_0',
    );
    expect(row?.id).toBe('flashcards_book_1_ch_0');
    expect(row?.type).toBe('flashcards');
    expect(row?.content).toEqual(cards);
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
    await expect(loadFlashcards(chapter(), API_KEY)).rejects.toBeTruthy();
    const row = await dbGet(STORE_GENERATED, 'flashcards_book_1_ch_0');
    expect(row).toBeUndefined();
  });
});

describe('appendFlashcards — More cards (AC #3)', () => {
  function seed(cards: Flashcard[]): Promise<void> {
    const row: GeneratedRow<Flashcard[]> = {
      id: 'flashcards_book_1_ch_0',
      chapterId: 'book_1_ch_0',
      type: 'flashcards',
      content: cards,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    return dbPut(STORE_GENERATED, row);
  }

  it('returns the initial set when no cache exists yet', async () => {
    const cards = makeCards(5);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse({ cards }));
    const out = await appendFlashcards(chapter(), API_KEY);
    expect(out).toEqual(cards);
  });

  it('appends new cards to the existing cached set', async () => {
    const existing = makeCards(5, 'Old');
    await seed(existing);
    const additions = makeCards(3, 'New');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse({ cards: additions }));
    const out = await appendFlashcards(chapter(), API_KEY);
    expect(out).toHaveLength(8);
    expect(out.slice(0, 5)).toEqual(existing);
    expect(out.slice(5)).toEqual(additions);
  });

  it('filters duplicates by front (case-insensitive, trimmed)', async () => {
    const existing: Flashcard[] = [
      { front: 'Photosynthesis', back: 'a' },
      { front: 'Chloroplast', back: 'b' },
      { front: 'Stoma', back: 'c' },
      { front: 'Xylem', back: 'd' },
      { front: 'Phloem', back: 'e' },
    ];
    await seed(existing);
    // additions overlap on different casing / whitespace + one truly new
    const additions: Flashcard[] = [
      { front: 'photosynthesis', back: 'dup-1' }, // case-insensitive dup
      { front: '  Chloroplast  ', back: 'dup-2' }, // whitespace dup
      { front: 'Mitochondrion', back: 'new' }, // genuinely new
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse({ cards: additions }));
    const out = await appendFlashcards(chapter(), API_KEY);
    expect(out).toHaveLength(6);
    expect(out[5]).toEqual({ front: 'Mitochondrion', back: 'new' });
  });

  it('writes the merged set back to the cache under the same key', async () => {
    const existing = makeCards(5, 'Old');
    await seed(existing);
    const additions = makeCards(2, 'New');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(anthropicResponse({ cards: additions }));
    await appendFlashcards(chapter(), API_KEY);
    const row = await dbGet<GeneratedRow<Flashcard[]>>(
      STORE_GENERATED,
      'flashcards_book_1_ch_0',
    );
    expect(row?.content).toHaveLength(7);
    expect(row?.id).toBe('flashcards_book_1_ch_0');
    expect(row?.type).toBe('flashcards');
  });

  it('augments the prompt to instruct against duplicating existing fronts', async () => {
    const existing: Flashcard[] = [
      { front: 'AlphaTerm', back: 'a' },
      { front: 'BetaTerm', back: 'b' },
      { front: 'GammaTerm', back: 'c' },
      { front: 'DeltaTerm', back: 'd' },
      { front: 'EpsilonTerm', back: 'e' },
    ];
    await seed(existing);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      anthropicResponse({ cards: makeCards(2, 'New') }),
    );
    await appendFlashcards(chapter(), API_KEY);
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string) as {
      messages: { content: string }[];
    };
    const sent = body.messages[0]!.content;
    expect(sent).toContain('AlphaTerm');
    expect(sent).toContain('EpsilonTerm');
  });
});
