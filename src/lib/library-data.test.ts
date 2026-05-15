import { describe, expect, it } from 'vitest';
import {
  computeStreak,
  pickDailyChapter,
  previousDate,
  summarizeBook,
  todayUtc,
  type ProgressRow,
} from './library-data';
import type { Book, Chapter } from './importers/types';

function makeBook(id: string, chapterCount: number, addedAt = '2026-05-12T00:00:00Z'): Book {
  return {
    id,
    title: id.toUpperCase(),
    author: null,
    addedAt,
    coverDataUrl: null,
    source: 'epub',
    chapterCount,
  };
}

function makeChapter(bookId: string, index: number): Chapter {
  return {
    id: `${bookId}_ch_${index}`,
    bookId,
    index,
    title: `Chapter ${index + 1}`,
    content: `content ${index}`,
  };
}

function makeProgress(bookId: string, index: number, date: string, completed = true): ProgressRow {
  return {
    id: `p_${bookId}_${index}`,
    bookId,
    chapterId: `${bookId}_ch_${index}`,
    completed,
    date,
  };
}

describe('summarizeBook', () => {
  it('reports 0 progress for a fresh book', () => {
    const book = makeBook('b', 3);
    const s = summarizeBook(book, [], []);
    expect(s.completedCount).toBe(0);
    expect(s.progressPct).toBe(0);
    expect(s.nextChapterIndex).toBe(0);
    expect(s.averageDifficulty).toBeNull();
  });

  it('counts completed chapters and reports the next incomplete', () => {
    const book = makeBook('b', 4);
    const s = summarizeBook(book, [], [
      makeProgress('b', 0, '2026-05-10'),
      makeProgress('b', 1, '2026-05-11'),
    ]);
    expect(s.completedCount).toBe(2);
    expect(s.progressPct).toBe(0.5);
    expect(s.nextChapterIndex).toBe(2);
  });

  it('returns nextChapterIndex=null when the book is finished', () => {
    const book = makeBook('b', 2);
    const s = summarizeBook(book, [], [
      makeProgress('b', 0, '2026-05-10'),
      makeProgress('b', 1, '2026-05-11'),
    ]);
    expect(s.nextChapterIndex).toBeNull();
    expect(s.progressPct).toBe(1);
  });

  it('ignores progress rows from other books', () => {
    const book = makeBook('b', 2);
    const s = summarizeBook(book, [], [
      makeProgress('a', 0, '2026-05-10'),
      makeProgress('a', 1, '2026-05-11'),
    ]);
    expect(s.completedCount).toBe(0);
  });

  it('treats incomplete-flagged rows as not completed', () => {
    const book = makeBook('b', 2);
    const s = summarizeBook(book, [], [makeProgress('b', 0, '2026-05-10', false)]);
    expect(s.completedCount).toBe(0);
  });

  it('reports averageDifficulty as null when no chapter has difficulty set', () => {
    const book = makeBook('b', 3);
    const chapters: Chapter[] = [
      { id: 'b_ch_0', bookId: 'b', index: 0, title: 'A', content: 'x' },
      { id: 'b_ch_1', bookId: 'b', index: 1, title: 'B', content: 'y' },
    ];
    expect(summarizeBook(book, chapters, []).averageDifficulty).toBeNull();
  });

  it('averages difficulty across chapters that have it set', () => {
    const book = makeBook('b', 3);
    const chapters: Chapter[] = [
      { id: 'b_ch_0', bookId: 'b', index: 0, title: 'A', content: 'x', difficulty: 4 },
      { id: 'b_ch_1', bookId: 'b', index: 1, title: 'B', content: 'y', difficulty: 2 },
      { id: 'b_ch_2', bookId: 'b', index: 2, title: 'C', content: 'z' },
    ];
    expect(summarizeBook(book, chapters, []).averageDifficulty).toBe(3);
  });

  it('scopes averageDifficulty to the target book', () => {
    const book = makeBook('b', 2);
    const chapters: Chapter[] = [
      { id: 'b_ch_0', bookId: 'b', index: 0, title: 'A', content: 'x', difficulty: 5 },
      { id: 'a_ch_0', bookId: 'a', index: 0, title: 'Z', content: 'z', difficulty: 1 },
    ];
    expect(summarizeBook(book, chapters, []).averageDifficulty).toBe(5);
  });
});

describe('previousDate / todayUtc', () => {
  it('previousDate handles month boundaries', () => {
    expect(previousDate('2026-06-01')).toBe('2026-05-31');
  });

  it('previousDate handles year boundaries', () => {
    expect(previousDate('2026-01-01')).toBe('2025-12-31');
  });

  it('todayUtc returns ISO date for the given Date', () => {
    expect(todayUtc(new Date('2026-05-12T18:00:00Z'))).toBe('2026-05-12');
  });
});

describe('computeStreak', () => {
  it('returns 0 when no progress', () => {
    expect(computeStreak([], '2026-05-12')).toBe(0);
  });

  it('returns 1 when today has progress but yesterday does not', () => {
    expect(
      computeStreak([makeProgress('b', 0, '2026-05-12')], '2026-05-12'),
    ).toBe(1);
  });

  it('returns 3 for three consecutive days', () => {
    const p = [
      makeProgress('b', 0, '2026-05-10'),
      makeProgress('b', 1, '2026-05-11'),
      makeProgress('b', 2, '2026-05-12'),
    ];
    expect(computeStreak(p, '2026-05-12')).toBe(3);
  });

  it('stops at the first gap', () => {
    const p = [
      makeProgress('b', 0, '2026-05-08'),
      makeProgress('b', 2, '2026-05-10'),
      makeProgress('b', 3, '2026-05-11'),
      makeProgress('b', 4, '2026-05-12'),
    ];
    expect(computeStreak(p, '2026-05-12')).toBe(3);
  });

  it('correctly handles cross-day boundary', () => {
    // Yesterday completion + nothing today → streak ends yesterday.
    const p = [makeProgress('b', 0, '2026-05-11')];
    expect(computeStreak(p, '2026-05-12')).toBe(0);
  });

  it('ignores incomplete rows', () => {
    const p = [makeProgress('b', 0, '2026-05-12', false)];
    expect(computeStreak(p, '2026-05-12')).toBe(0);
  });
});

describe('pickDailyChapter', () => {
  it('returns null when no books exist', () => {
    expect(pickDailyChapter([], [], [])).toBeNull();
  });

  it('returns null when every book is fully read', () => {
    const b = makeBook('b', 1);
    const c = makeChapter('b', 0);
    const p = [makeProgress('b', 0, '2026-05-12')];
    expect(pickDailyChapter([b], [c], p)).toBeNull();
  });

  it('picks the next incomplete chapter of a single book', () => {
    const b = makeBook('b', 2);
    const c0 = makeChapter('b', 0);
    const c1 = makeChapter('b', 1);
    const result = pickDailyChapter([b], [c0, c1], [makeProgress('b', 0, '2026-05-12')]);
    expect(result?.chapter.id).toBe('b_ch_1');
  });

  it('prefers the most recently opened book (two-book fixture)', () => {
    // Book A added earlier with old progress; Book B added later with
    // recent progress → suggestion should come from B.
    const a = makeBook('a', 2, '2026-05-01T00:00:00Z');
    const b = makeBook('b', 2, '2026-05-10T00:00:00Z');
    const chapters = [makeChapter('a', 0), makeChapter('a', 1), makeChapter('b', 0), makeChapter('b', 1)];
    const progress = [makeProgress('a', 0, '2026-05-05'), makeProgress('b', 0, '2026-05-12')];
    const result = pickDailyChapter([a, b], chapters, progress);
    expect(result?.book.id).toBe('b');
    expect(result?.chapter.id).toBe('b_ch_1');
  });

  it('falls back to addedAt when no progress yet exists', () => {
    const a = makeBook('a', 1, '2026-05-01T00:00:00Z');
    const b = makeBook('b', 1, '2026-05-10T00:00:00Z');
    const chapters = [makeChapter('a', 0), makeChapter('b', 0)];
    const result = pickDailyChapter([a, b], chapters, []);
    expect(result?.book.id).toBe('b');
  });

  it('skips fully-read books when picking', () => {
    const a = makeBook('a', 1, '2026-05-10T00:00:00Z');
    const b = makeBook('b', 1, '2026-05-01T00:00:00Z');
    const chapters = [makeChapter('a', 0), makeChapter('b', 0)];
    // A is more recent + fully read; B is older + unread.
    const result = pickDailyChapter([a, b], chapters, [makeProgress('a', 0, '2026-05-12')]);
    expect(result?.book.id).toBe('b');
  });
});
