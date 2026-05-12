import { describe, expect, it } from 'vitest';
import { DEFAULT_WORDS_PER_CHAPTER, splitIntoChapters } from './chapters';

function words(n: number, word = 'lorem'): string {
  return Array(n).fill(word).join(' ');
}

describe('splitIntoChapters', () => {
  it('returns a single empty chapter for empty input', () => {
    const chapters = splitIntoChapters('');
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.content).toBe('');
  });

  it('keeps a short text in one chapter', () => {
    const chapters = splitIntoChapters(words(50));
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.title).toBe('Chapter 1');
  });

  it('splits at paragraph boundaries when over the target', () => {
    // Two paragraphs of 1500 words each at default 2000 wpc.
    const text = `${words(1500)}\n\n${words(1500)}`;
    const chapters = splitIntoChapters(text);
    expect(chapters.length).toBeGreaterThanOrEqual(1);
    expect(chapters[0]!.content).toContain('lorem');
  });

  it('respects a custom wordsPerChapter', () => {
    const text = `${words(120)}\n\n${words(120)}\n\n${words(120)}`;
    const chapters = splitIntoChapters(text, 100);
    expect(chapters).toHaveLength(3);
  });

  it('numbers chapters starting at 1 in the title', () => {
    const text = `${words(120)}\n\n${words(120)}\n\n${words(120)}`;
    const chapters = splitIntoChapters(text, 100);
    expect(chapters.map((c) => c.title)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
  });

  it('preserves paragraph breaks within a chapter', () => {
    const text = 'a\n\nb\n\nc';
    const chapters = splitIntoChapters(text);
    expect(chapters[0]!.content).toBe('a\n\nb\n\nc');
  });

  it('rejects an unreasonably low wordsPerChapter', () => {
    expect(() => splitIntoChapters('x', 50)).toThrow();
  });

  it('exposes the documented default', () => {
    expect(DEFAULT_WORDS_PER_CHAPTER).toBe(2000);
  });

  it('indexes chapters from zero', () => {
    const text = `${words(120)}\n\n${words(120)}`;
    const chapters = splitIntoChapters(text, 100);
    expect(chapters.map((c) => c.index)).toEqual([0, 1]);
  });
});
