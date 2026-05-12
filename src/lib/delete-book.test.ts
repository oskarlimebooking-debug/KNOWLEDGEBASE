import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { deleteBookCascade } from './delete-book';
import { closeDb, dbGet, dbGetAll, dbPut } from '../data/db';
import {
  STORE_BOOKS,
  STORE_CHAPTERS,
  STORE_GENERATED,
  STORE_PROGRESS,
} from '../data/schema';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeDb();
});

async function seedTwoBooks(): Promise<void> {
  await dbPut(STORE_BOOKS, { id: 'a', title: 'A', addedAt: '2026-05-12' });
  await dbPut(STORE_BOOKS, { id: 'b', title: 'B', addedAt: '2026-05-12' });
  await dbPut(STORE_CHAPTERS, { id: 'a_ch_0', bookId: 'a', index: 0, content: 'x' });
  await dbPut(STORE_CHAPTERS, { id: 'a_ch_1', bookId: 'a', index: 1, content: 'y' });
  await dbPut(STORE_CHAPTERS, { id: 'b_ch_0', bookId: 'b', index: 0, content: 'z' });
  await dbPut(STORE_PROGRESS, { id: 'pa0', bookId: 'a', chapterId: 'a_ch_0', completed: true, date: '2026-05-12' });
  await dbPut(STORE_PROGRESS, { id: 'pa1', bookId: 'a', chapterId: 'a_ch_1', completed: true, date: '2026-05-12' });
  await dbPut(STORE_PROGRESS, { id: 'pb0', bookId: 'b', chapterId: 'b_ch_0', completed: false, date: '2026-05-12' });
  await dbPut(STORE_GENERATED, { id: 'ga0', chapterId: 'a_ch_0', type: 'summary', content: '…' });
  await dbPut(STORE_GENERATED, { id: 'ga1', chapterId: 'a_ch_1', type: 'summary', content: '…' });
  await dbPut(STORE_GENERATED, { id: 'gb0', chapterId: 'b_ch_0', type: 'summary', content: '…' });
}

describe('deleteBookCascade', () => {
  it('removes the book row', async () => {
    await seedTwoBooks();
    await deleteBookCascade('a');
    expect(await dbGet(STORE_BOOKS, 'a')).toBeUndefined();
  });

  it('removes every chapter, progress, and generated row for the target book', async () => {
    await seedTwoBooks();
    await deleteBookCascade('a');
    const chapters = await dbGetAll<{ id: string }>(STORE_CHAPTERS);
    const progress = await dbGetAll<{ id: string }>(STORE_PROGRESS);
    const generated = await dbGetAll<{ id: string }>(STORE_GENERATED);
    expect(chapters.map((c) => c.id).sort()).toEqual(['b_ch_0']);
    expect(progress.map((p) => p.id).sort()).toEqual(['pb0']);
    expect(generated.map((g) => g.id).sort()).toEqual(['gb0']);
  });

  it('leaves untouched books intact', async () => {
    await seedTwoBooks();
    await deleteBookCascade('a');
    const remaining = await dbGet<{ id: string; title: string }>(STORE_BOOKS, 'b');
    expect(remaining?.title).toBe('B');
  });

  it('is idempotent (no-op for a missing book)', async () => {
    await seedTwoBooks();
    await expect(deleteBookCascade('ghost')).resolves.toBeUndefined();
    expect(await dbGet(STORE_BOOKS, 'a')).toBeDefined();
  });
});
