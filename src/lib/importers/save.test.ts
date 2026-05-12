import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { saveImportedBook } from './save';
import { closeDb, dbGet, dbGetAll, dbGetByIndex } from '../../data/db';
import { STORE_BOOKS, STORE_CHAPTERS } from '../../data/schema';
import type { Book, Chapter, ImportedBook } from './types';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

function makeImported(overrides: Partial<Book> = {}): ImportedBook {
  const book: Book = {
    id: 'b1',
    title: 'Test Book',
    author: 'Author',
    addedAt: '2026-05-12T00:00:00Z',
    coverDataUrl: null,
    source: 'epub',
    chapterCount: 2,
    ...overrides,
  };
  const chapters: Chapter[] = [
    { id: 'b1_ch_0', bookId: 'b1', index: 0, title: 'Chapter 1', content: 'one' },
    { id: 'b1_ch_1', bookId: 'b1', index: 1, title: 'Chapter 2', content: 'two' },
  ];
  return { book, chapters };
}

describe('saveImportedBook', () => {
  it('writes the book row', async () => {
    const imported = makeImported();
    await saveImportedBook(imported);
    const got = await dbGet<Book>(STORE_BOOKS, 'b1');
    expect(got?.title).toBe('Test Book');
  });

  it('writes every chapter row', async () => {
    const imported = makeImported();
    await saveImportedBook(imported);
    const chapters = await dbGetByIndex<Chapter>(STORE_CHAPTERS, 'bookId', 'b1');
    expect(chapters).toHaveLength(2);
    expect(chapters.map((c) => c.index).sort()).toEqual([0, 1]);
  });

  it('overwrites on re-save (same id)', async () => {
    await saveImportedBook(makeImported({ title: 'V1' }));
    await saveImportedBook(makeImported({ title: 'V2' }));
    const got = await dbGet<Book>(STORE_BOOKS, 'b1');
    expect(got?.title).toBe('V2');
  });

  it('rolls back when a chapter row is malformed (missing keyPath)', async () => {
    const imported = makeImported();
    // Sneak a bad row in. Chapters store keys on `id`; this row has none.
    (imported.chapters[1] as unknown as Record<string, unknown>) = {
      bookId: 'b1',
      index: 1,
      title: 'busted',
      content: '',
    };
    await expect(saveImportedBook(imported)).rejects.toBeTruthy();
    // Critical: the book row must NOT exist either (rollback).
    const books = await dbGetAll(STORE_BOOKS);
    expect(books).toHaveLength(0);
    const chapters = await dbGetAll(STORE_CHAPTERS);
    expect(chapters).toHaveLength(0);
  });
});
