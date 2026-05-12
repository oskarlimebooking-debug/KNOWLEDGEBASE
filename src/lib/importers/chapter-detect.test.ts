import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectChapterPatterns, enhanceChapterTitles } from './chapter-detect';
import type { ChapterSlice } from './chapters';

function body(prefix: string): string {
  // ~50 words of filler so detected chapters look realistic.
  return `${prefix} ${Array(50).fill('word').join(' ')}.`;
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectChapterPatterns — no detection', () => {
  it('returns null for empty input', () => {
    expect(detectChapterPatterns('')).toBeNull();
  });

  it('returns null when no patterns appear', () => {
    expect(detectChapterPatterns('a long body of prose with no headings.')).toBeNull();
  });

  it('returns null when only one Chapter heading appears (need ≥ 2)', () => {
    expect(detectChapterPatterns(`Chapter 1\n${body('p')}`)).toBeNull();
  });

  it('does not fire on inline mentions of "Section 1.2"', () => {
    expect(
      detectChapterPatterns(
        'See Section 1.2 of the paper for details. Another sentence here.',
      ),
    ).toBeNull();
  });

  it('does not false-positive on prose lines that start with a number', () => {
    // "2 people" / "3 things" on their own line is not a Roman/numeric heading
    // because our pattern requires a period after the number.
    expect(
      detectChapterPatterns('2 people went to lunch\n\n3 things happened today'),
    ).toBeNull();
  });
});

describe('detectChapterPatterns — Chapter form', () => {
  it('detects "Chapter 1 / Chapter 2"', () => {
    const text = `Chapter 1\n${body('intro')}\n\nChapter 2\n${body('next')}`;
    const slices = detectChapterPatterns(text);
    expect(slices).not.toBeNull();
    expect(slices).toHaveLength(2);
    expect(slices![0]!.title.toLowerCase()).toContain('chapter 1');
  });

  it('detects CAPS + word form ("CHAPTER ONE / CHAPTER TWO")', () => {
    const text = `CHAPTER ONE\n${body('a')}\n\nCHAPTER TWO\n${body('b')}`;
    const slices = detectChapterPatterns(text);
    expect(slices).toHaveLength(2);
  });

  it('detects Roman form ("Chapter I / Chapter II / Chapter III")', () => {
    const text = `Chapter I\n${body('a')}\n\nChapter II\n${body('b')}\n\nChapter III\n${body('c')}`;
    const slices = detectChapterPatterns(text);
    expect(slices).toHaveLength(3);
  });

  it('detects mixed-case ("chapter 1 / chapter 2")', () => {
    const text = `chapter 1\n${body('a')}\n\nchapter 2\n${body('b')}`;
    expect(detectChapterPatterns(text)).toHaveLength(2);
  });

  it('keeps the title text after the heading number on the same line', () => {
    const text = `Chapter 1 The Beginning\n${body('a')}\n\nChapter 2 The Middle\n${body('b')}`;
    const slices = detectChapterPatterns(text)!;
    expect(slices[0]!.title).toContain('The Beginning');
    expect(slices[1]!.title).toContain('The Middle');
  });
});

describe('detectChapterPatterns — Part form (textbook)', () => {
  it('detects "Part I / Part II / Part III"', () => {
    const text = `Part I\n${body('a')}\n\nPart II\n${body('b')}\n\nPart III\n${body('c')}`;
    const slices = detectChapterPatterns(text);
    expect(slices).toHaveLength(3);
  });

  it('detects "Part 1 / Part 2"', () => {
    const text = `Part 1\n${body('a')}\n\nPart 2\n${body('b')}`;
    expect(detectChapterPatterns(text)).toHaveLength(2);
  });
});

describe('detectChapterPatterns — Section form (paper)', () => {
  it('detects "Section 3 / Section 4"', () => {
    const text = `Section 3\n${body('a')}\n\nSection 4\n${body('b')}`;
    expect(detectChapterPatterns(text)).toHaveLength(2);
  });

  it('detects dotted sections "1.1 / 1.2 / 2.1"', () => {
    const text = `Section 1.1\n${body('a')}\n\nSection 1.2\n${body('b')}\n\nSection 2.1\n${body('c')}`;
    expect(detectChapterPatterns(text)).toHaveLength(3);
  });
});

describe('detectChapterPatterns — numeric/Roman heading fallback', () => {
  it('detects "1. Title / 2. Title" on their own lines', () => {
    const text = `1. Introduction\n${body('a')}\n\n2. Methods\n${body('b')}\n\n3. Results\n${body('c')}`;
    const slices = detectChapterPatterns(text);
    expect(slices).toHaveLength(3);
    expect(slices![0]!.title).toContain('Introduction');
  });

  it('detects Roman headings "I. Title / II. Title"', () => {
    const text = `I. Background\n${body('a')}\n\nII. Approach\n${body('b')}`;
    const slices = detectChapterPatterns(text);
    expect(slices).toHaveLength(2);
  });
});

describe('detectChapterPatterns — priority order', () => {
  it('prefers Chapter over Part when both appear', () => {
    const text = `Chapter 1\n${body('a')}\n\nPart II\n${body('b')}\n\nChapter 2\n${body('c')}`;
    const slices = detectChapterPatterns(text)!;
    // Chapter wins (≥ 2 matches at priority 1), so we get 2 chapters
    expect(slices).toHaveLength(2);
    expect(slices[0]!.title.toLowerCase()).toContain('chapter');
  });

  it('prefers Part over Section when both appear', () => {
    const text = `Part I\n${body('a')}\n\nPart II\n${body('b')}\n\nSection 1\n${body('c')}\n\nSection 2\n${body('d')}`;
    const slices = detectChapterPatterns(text)!;
    expect(slices).toHaveLength(2);
    expect(slices[0]!.title.toLowerCase()).toContain('part');
  });
});

describe('detectChapterPatterns — slice shape', () => {
  it('indexes chapters from zero', () => {
    const text = `Chapter 1\n${body('a')}\n\nChapter 2\n${body('b')}\n\nChapter 3\n${body('c')}`;
    const slices = detectChapterPatterns(text)!;
    expect(slices.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('preserves chapter body content between headings', () => {
    const text = `Chapter 1\nFirst body.\n\nChapter 2\nSecond body.`;
    const slices = detectChapterPatterns(text)!;
    expect(slices[0]!.content).toContain('First body.');
    expect(slices[1]!.content).toContain('Second body.');
  });

  it('caps overly long heading titles at the documented limit', () => {
    const longTitle = 'Chapter 1 ' + 'x'.repeat(200);
    const text = `${longTitle}\n${body('a')}\n\nChapter 2\n${body('b')}`;
    const slices = detectChapterPatterns(text)!;
    expect(slices[0]!.title.length).toBeLessThanOrEqual(100);
  });
});

describe('enhanceChapterTitles', () => {
  function makeChapters(): ChapterSlice[] {
    return [
      { index: 0, title: 'Chapter 1', content: 'About space travel and stars.' },
      { index: 1, title: 'Chapter 2', content: 'About ocean currents and waves.' },
    ];
  }

  it('returns chapters unchanged when no API key is provided', async () => {
    const before = makeChapters();
    const after = await enhanceChapterTitles(before, '');
    expect(after).toEqual(before);
  });

  it('returns chapters unchanged for an empty list', async () => {
    expect(await enhanceChapterTitles([], 'sk-ant-test-xyz')).toEqual([]);
  });

  it('applies AI-suggested titles when the response parses', async () => {
    const response = {
      id: 'msg_x',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text: JSON.stringify(['Voyage to the Stars', 'Tides of the Sea']) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const after = await enhanceChapterTitles(makeChapters(), 'sk-ant-test-xyz');
    expect(after[0]!.title).toBe('Voyage to the Stars');
    expect(after[1]!.title).toBe('Tides of the Sea');
  });

  it('uses a SINGLE batched API call (not one per chapter)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'msg_x',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [{ type: 'text', text: JSON.stringify(['A', 'B', 'C', 'D']) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const four: ChapterSlice[] = [
      { index: 0, title: 'a', content: 'one' },
      { index: 1, title: 'b', content: 'two' },
      { index: 2, title: 'c', content: 'three' },
      { index: 3, title: 'd', content: 'four' },
    ];
    await enhanceChapterTitles(four, 'sk-ant-test-xyz');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('returns originals when the AI call fails', async () => {
    // 400 isn't retried; one fetch call exercises the failure path.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'no' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const before = makeChapters();
    const after = await enhanceChapterTitles(before, 'sk-ant-test-xyz');
    expect(after).toEqual(before);
  });

  it('returns originals when the AI response is not a JSON array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'msg_x',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [{ type: 'text', text: 'not json at all' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const before = makeChapters();
    expect(await enhanceChapterTitles(before, 'sk-ant-test-xyz')).toEqual(before);
  });

  it('keeps original title when the AI returns non-string for an entry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'msg_x',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [{ type: 'text', text: JSON.stringify(['Good Title', 42]) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const before = makeChapters();
    const after = await enhanceChapterTitles(before, 'sk-ant-test-xyz');
    expect(after[0]!.title).toBe('Good Title');
    expect(after[1]!.title).toBe('Chapter 2'); // unchanged
  });
});
