import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  markChapterComplete,
  renderChapter,
  splitParagraphs,
  type ChapterViewData,
} from './chapter-view';
import { closeDb, dbGetAll } from '../data/db';
import { STORE_PROGRESS } from '../data/schema';
import type { Chapter } from '../lib/importers/types';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

function makeChapter(): Chapter {
  return {
    id: 'b_ch_1',
    bookId: 'b',
    index: 1,
    title: 'Chapter Two',
    content: 'First paragraph.\n\nSecond paragraph.\n\nThird.',
  };
}

function makeData(overrides: Partial<ChapterViewData> = {}): ChapterViewData {
  return {
    chapter: makeChapter(),
    prevId: 'b_ch_0',
    nextId: 'b_ch_2',
    completed: false,
    ...overrides,
  };
}

describe('splitParagraphs', () => {
  it('splits on blank lines and preserves order', () => {
    const out = splitParagraphs('one\n\ntwo\n\nthree');
    expect(out).toEqual(['one', 'two', 'three']);
  });

  it('handles multi-blank-line gaps as a single break (AC: preserves blanks)', () => {
    const out = splitParagraphs('one\n\n\n\ntwo');
    expect(out).toEqual(['one', 'two']);
  });

  it('trims whitespace around paragraphs', () => {
    const out = splitParagraphs('  one  \n\n  two  ');
    expect(out).toEqual(['one', 'two']);
  });

  it('returns [] for empty input', () => {
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs('   \n\n   ')).toEqual([]);
  });
});

describe('renderChapter', () => {
  it('renders the chapter title and paragraphs', () => {
    const tree = renderChapter(makeData());
    const json = JSON.stringify(tree);
    expect(json).toContain('Chapter Two');
    expect(json).toContain('First paragraph.');
    expect(json).toContain('Second paragraph.');
    expect(json).toContain('Third.');
  });

  it('renders one <p> per paragraph (preserves blank-line splits)', () => {
    const tree = renderChapter(makeData());
    const json = JSON.stringify(tree);
    const paraCount = (json.match(/"chapter-view__para"/g) ?? []).length;
    expect(paraCount).toBe(3);
  });

  it('renders Prev / Mark Complete / Next in the nav row', () => {
    const tree = renderChapter(makeData());
    const json = JSON.stringify(tree);
    expect(json).toContain('"data-role":"prev"');
    expect(json).toContain('"data-role":"mark-complete"');
    expect(json).toContain('"data-role":"next"');
  });

  it('disables Prev when prevId is null (boundary)', () => {
    const tree = renderChapter(makeData({ prevId: null }));
    const json = JSON.stringify(tree);
    expect(json).toContain('"disabled":"true"');
    expect(json).toContain('"aria-disabled":"true"');
  });

  it('disables Next when nextId is null (boundary)', () => {
    const tree = renderChapter(makeData({ nextId: null }));
    const json = JSON.stringify(tree);
    // Two disabled buttons would mean both Prev and Next are at the
    // boundary — that's not the case here, so we expect exactly one.
    const count = (json.match(/"disabled":"true"/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('shows "Mark Complete" with aria-pressed=false when not completed', () => {
    const tree = renderChapter(makeData({ completed: false }));
    const json = JSON.stringify(tree);
    expect(json).toContain('Mark Complete');
    expect(json).toContain('"aria-pressed":"false"');
  });

  it('shows "✓ Completed" with aria-pressed=true when completed', () => {
    const tree = renderChapter(makeData({ completed: true }));
    const json = JSON.stringify(tree);
    expect(json).toContain('✓ Completed');
    expect(json).toContain('"aria-pressed":"true"');
    expect(json).toContain('chapter-view__mark--done');
  });

  it('renders a placeholder for an empty chapter', () => {
    const ch = makeChapter();
    ch.content = '';
    const tree = renderChapter(makeData({ chapter: ch }));
    expect(JSON.stringify(tree)).toContain('(empty chapter)');
  });
});

describe('markChapterComplete', () => {
  it('writes a progress row with completed=true and today\'s date', async () => {
    await markChapterComplete('b', 'b_ch_1');
    const rows = await dbGetAll<{ bookId: string; chapterId: string; completed: boolean; date: string }>(
      STORE_PROGRESS,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.bookId).toBe('b');
    expect(rows[0]!.chapterId).toBe('b_ch_1');
    expect(rows[0]!.completed).toBe(true);
    expect(rows[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is idempotent — repeated calls do not stack rows', async () => {
    await markChapterComplete('b', 'b_ch_1');
    await markChapterComplete('b', 'b_ch_1');
    const rows = await dbGetAll(STORE_PROGRESS);
    expect(rows).toHaveLength(1);
  });
});
