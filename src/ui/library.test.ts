import { describe, expect, it } from 'vitest';
import { renderLibrary } from './library';
import type { LibraryData } from './library';
import type { Book, Chapter } from '../lib/importers/types';
import type { BookSummary, DailySuggestion } from '../lib/library-data';

function makeBook(id: string, chapterCount: number, addedAt = '2026-05-12T00:00:00Z'): Book {
  return {
    id,
    title: `Book ${id}`,
    author: 'Author',
    addedAt,
    coverDataUrl: null,
    source: 'epub',
    chapterCount,
  };
}

function makeSummary(book: Book, completedCount = 0): BookSummary {
  return {
    book,
    completedCount,
    progressPct: book.chapterCount === 0 ? 0 : completedCount / book.chapterCount,
    nextChapterIndex: completedCount < book.chapterCount ? completedCount : null,
  };
}

function makeData(summaries: BookSummary[], daily: DailySuggestion | null, streak: number): LibraryData {
  return { summaries, daily, streak };
}

describe('renderLibrary', () => {
  it('renders empty state when no books', () => {
    const tree = renderLibrary(makeData([], null, 0));
    const json = JSON.stringify(tree);
    expect(json).toContain('library-empty');
    expect(json).toContain('Add your first book');
    expect(json).not.toContain('streak-chip');
  });

  it('always includes Add Book + file input controls', () => {
    const tree = renderLibrary(makeData([], null, 0));
    const json = JSON.stringify(tree);
    expect(json).toContain('library__add');
    expect(json).toContain('library__file-input');
    expect(json).toContain('+ Add Book');
  });

  it('renders streak chip with day count', () => {
    const tree = renderLibrary(makeData([makeSummary(makeBook('b', 2))], null, 3));
    const json = JSON.stringify(tree);
    expect(json).toContain('streak-chip');
    expect(json).toContain('3 days');
  });

  it('pluralises streak label correctly for single day', () => {
    const tree = renderLibrary(makeData([makeSummary(makeBook('b', 1))], null, 1));
    expect(JSON.stringify(tree)).toContain('1 day');
  });

  it('renders the daily card when a suggestion exists', () => {
    const book = makeBook('b', 2);
    const chapter: Chapter = {
      id: 'b_ch_0',
      bookId: 'b',
      index: 0,
      title: 'Chapter 1',
      content: 'x',
    };
    const daily: DailySuggestion = { book, chapter, summary: makeSummary(book) };
    const tree = renderLibrary(makeData([makeSummary(book)], daily, 1));
    const json = JSON.stringify(tree);
    expect(json).toContain('daily-card');
    expect(json).toContain('Chapter 1');
    expect(json).toContain('Book b');
  });

  it('omits the daily card when no suggestion', () => {
    const tree = renderLibrary(makeData([makeSummary(makeBook('b', 1))], null, 0));
    expect(JSON.stringify(tree)).not.toContain('daily-card');
  });

  it('renders one book-card per summary', () => {
    const books = [makeBook('a', 1), makeBook('b', 1), makeBook('c', 1)];
    const tree = renderLibrary(makeData(books.map((b) => makeSummary(b)), null, 0));
    const json = JSON.stringify(tree);
    const count = (json.match(/"book-card"/g) ?? []).length;
    expect(count).toBe(3);
  });

  it('renders progress bar with aria-valuenow', () => {
    const book = makeBook('b', 4);
    const tree = renderLibrary(makeData([makeSummary(book, 2)], null, 0));
    const json = JSON.stringify(tree);
    expect(json).toContain('"aria-valuenow":"50"');
    expect(json).toContain('50%');
  });

  it('uses placeholder emoji when no coverDataUrl', () => {
    const book = makeBook('b', 1);
    book.title = 'Stoic Philosophy for Beginners';
    const tree = renderLibrary(makeData([makeSummary(book)], null, 0));
    expect(JSON.stringify(tree)).toContain('🧠'); // emojiFromKeyword('philosophy')
  });

  it('uses <img> when coverDataUrl is set', () => {
    const book = makeBook('b', 1);
    book.coverDataUrl = 'data:image/jpeg;base64,...';
    const tree = renderLibrary(makeData([makeSummary(book)], null, 0));
    const json = JSON.stringify(tree);
    expect(json).toContain('"tag":"img"');
    expect(json).toContain('"loading":"lazy"');
  });

  it('builds the data tree for 50 books in well under the AC budget', () => {
    // AC #1: "Library renders ≤ 100ms for a 50-book library on a
    // baseline laptop." Real-DOM perf depends on browser layout, but
    // the data-tree construction is the part this module owns and is
    // a tight upper bound — if the tree alone takes longer than the
    // budget, no amount of optimisation elsewhere recovers.
    const summaries = Array.from({ length: 50 }, (_, i) =>
      makeSummary(makeBook(`b${i}`, 10), i % 10),
    );
    const t0 = performance.now();
    const tree = renderLibrary(makeData(summaries, null, 5));
    const t1 = performance.now();
    expect(t1 - t0).toBeLessThan(50);
    // Cheap sanity check that the tree actually carries 50 cards.
    const json = JSON.stringify(tree);
    const count = (json.match(/"book-card"/g) ?? []).length;
    expect(count).toBe(50);
  });
});
